import React, { useMemo, useState } from 'react';
import { Card, Loading, ErrorState, Table, ToggleButton } from '../components/ui';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { JiraEnv, getBoards, getActiveSprints, getSprints, searchIssuesJQL, extractIssueInfo, getMyself, buildSprintlessJql, searchIssuesForSprintless, getLastJiraError } from '../client/jiraClient';
import useCachedFetch from '../hooks/useCachedFetch';
import { computeBurndown } from '../utils/burndown';

// PUBLIC_INTERFACE
export default function JiraBurndown() {
  /**
   * Jira Burndown page
   * - Controls to select project key, board, sprint
   * - Load button to fetch issues via JQL and compute burndown
   * - Chart via Recharts for remaining vs ideal
   * - Table of included issues
   * - Mock mode when env isn't configured
   * SECURITY: Never log token or Authorization; warn if no backend proxy exists
   */
  const env = JiraEnv.get();
  const isConfigured = JiraEnv.isConfigured();
  const [projectKey, setProjectKey] = useState(env.projectKey || '');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('');
  const [showAllBoards, setShowAllBoards] = useState(false); // default filter to Scrum
  const [kanbanNotice, setKanbanNotice] = useState(''); // banner when board has no sprints
  const [sprintlessMode, setSprintlessMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(() => defaultStartISO());
  const [rangeEnd, setRangeEnd] = useState(() => defaultEndISO());
  const [useDemo, setUseDemo] = useState(!isConfigured); // default to demo if not configured
  const [burndown, setBurndown] = useState([]);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Diagnostics panel
  const [showDiag, setShowDiag] = useState(false);
  const [health, setHealth] = useState({ status: 'idle', detail: '', proxy: null });

  // Local proxy detection (not a hook): dev mode + site configured implies proxy available
  const proxyActive = (process.env.NODE_ENV !== 'production') && Boolean(env.site);

  // Boards list
  const boardsKey = `jira:boards:${projectKey}`;
  const { data: boardsData, loading: boardsLoading, error: boardsError, refetch: refetchBoards } = useCachedFetch({
    key: projectKey ? boardsKey : null,
    ttlMs: 60_000,
    fetcher: async (signal) => {
      return getBoards(projectKey || env.projectKey || 'DEMO', signal);
    },
    deps: [projectKey, env.projectKey, isConfigured],
    immediate: !!projectKey || !!env.projectKey || useDemo,
  });

  const boardsRaw = Array.isArray(boardsData?.values) ? boardsData.values : [];
  const boards = useMemo(() => {
    if (showAllBoards) return boardsRaw;
    // filter to Scrum or supportsSprints boards
    return boardsRaw.filter((b) => String(b?.type).toLowerCase() === 'scrum' || b?.supportsSprints);
  }, [boardsRaw, showAllBoards]);

  // Sprints for selected board
  const sprintsKey = `jira:sprints:${selectedBoard}`;
  const { data: sprintsData, loading: sprintsLoading, error: sprintsError, refetch: refetchSprints } = useCachedFetch({
    key: selectedBoard ? sprintsKey : null,
    ttlMs: 60_000,
    fetcher: async (signal) => {
      if (!selectedBoard) return { values: [] };
      const res = await getSprints(selectedBoard, { state: 'active' }, signal);
      // Set a banner if board doesn't support sprints
      if (res?.error?.code === 'NO_SPRINTS') {
        setKanbanNotice('This board does not support sprints (likely Kanban). Choose a Scrum board for sprint burndown or enable Sprintless mode.');
        return { values: [] };
      }
      setKanbanNotice('');
      return res;
    },
    deps: [selectedBoard],
    immediate: !!selectedBoard,
  });

  const sprints = Array.isArray(sprintsData?.values) ? sprintsData.values : [];

  const selectedSprintObj = useMemo(() => {
    return sprints.find((s) => String(s.id) === String(selectedSprint));
  }, [sprints, selectedSprint]);

  const canLoad = Boolean((projectKey || env.projectKey) && selectedBoard && selectedSprint && !sprintlessMode);

  async function handleLoad() {
    setLoading(true);
    setError('');
    setBurndown([]);
    setIssues([]);
    try {
      const key = projectKey || env.projectKey || 'DEMO';

      if (sprintlessMode) {
        // Sprintless: remaining issues count over a date range
        const extra = ''; // reserved for future filters
        const res = await searchIssuesForSprintless(key, extra, undefined);
        const items = Array.isArray(res?.issues) ? res.issues : [];

        const series = computeSprintlessBurndownByCount({
          startDateISO: rangeStart,
          endDateISO: rangeEnd,
          issues: items,
        });
        setIssues(items.map((it) => extractIssueInfo(it))); // show minimal table
        setBurndown(series);
      } else {
        // Sprint-specific burndown
        const jql = `project = ${key} AND sprint = ${selectedSprint}`;
        const result = await searchIssuesJQL(jql, ['summary', 'status', 'assignee', 'updated', 'resolutiondate'], undefined);
        const storyPointsFieldId = 'customfield_10016'; // used by extract; dynamic detection handled in searchIssuesJQL
        const normalized = (result?.issues || []).map((it) => extractIssueInfo(it, storyPointsFieldId));
        setIssues(normalized);

        const startISO = selectedSprintObj?.startDate || defaultStartISO();
        const endISO = selectedSprintObj?.endDate || defaultEndISO();
        const data = computeBurndown({
          startDateISO: startISO,
          endDateISO: endISO,
          issues: normalized,
          storyPointsFieldId,
        });
        setBurndown(data);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load Jira data');
    } finally {
      setLoading(false);
    }
  }

  const issueColumns = useMemo(
    () => [
      { key: 'key', label: 'Key' },
      { key: 'summary', label: 'Summary' },
      { key: 'points', label: 'Points', render: (r) => (Number.isFinite(r.points) ? r.points : '-') },
      { key: 'status', label: 'Status' },
      { key: 'resolutiondate', label: 'Resolved', render: (r) => (r.resolutiondate ? new Date(r.resolutiondate).toLocaleDateString() : '-') },
    ],
    []
  );

  const hasChart = burndown.length > 0;

  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="neon-card card-accent-emerald" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="col">
            <div className="section-title">
              <span className="text-gradient">🧭 Jira Burndown</span>
            </div>
            <div className="section-subtitle">
              Visualize sprint progress. Uses Basic Auth to the Jira Cloud API when configured; falls back to demo data if not.
            </div>
            {!isConfigured && (
              <div className="small" style={{ color: '#F59E0B' }}>
                Warning: Running without a secure backend proxy. Demo mode is enabled. For production, add a backend proxy to avoid exposing tokens in the frontend.
              </div>
            )}
          </div>
          <div className="row">
            <ToggleButton
              active={useDemo}
              onToggle={() => setUseDemo((v) => !v)}
              onLabel="Demo Data: On"
              offLabel="Demo Data: Off"
            />
            <button className="btn" style={{ marginLeft: 8 }} onClick={() => setShowDiag((v) => !v)}>
              {showDiag ? 'Hide Diagnostics' : 'Show Diagnostics'}
            </button>
          </div>
        </div>
      </div>

      {showDiag && (
        <Card title="Jira Diagnostics" subtitle="Environment check and connectivity health" className="card-accent-red">
          <div className="grid grid-3">
            <div className="col">
              <div className="small">Env Present</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="neon-badge neon-badge--success">SITE: {env.site ? 'Yes' : 'No'}</span>
                <span className="neon-badge neon-badge--success">PROJECT: {env.projectKey ? 'Yes' : 'No'}</span>
                <span className="neon-badge neon-badge--success">EMAIL: {env.email ? 'Yes' : 'No'}</span>
                <span className="neon-badge neon-badge--success">TOKEN: {env.token ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div className="col">
              <div className="small">Proxy Mode</div>
              <div>
                {proxyActive
                  ? 'Using /jira dev proxy (recommended in development).'
                  : 'Direct Jira API calls (may be blocked by CORS).'}
              </div>
            </div>
            <div className="col">
              <div className="small">Health Check</div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    try {
                      setHealth({ status: 'loading', detail: '', proxy: null });
                      const res = await getMyself();
                      const who = res?.displayName || res?.accountId || (res?.ok ? 'OK' : 'Unknown');
                      const proxyInfo = typeof res?.ok !== 'undefined'
                        ? { ok: !!res.ok, status: res.status || 200 }
                        : null;
                      setHealth({ status: 'ok', detail: String(who), proxy: proxyInfo });
                    } catch (e) {
                      const last = getLastJiraError();
                      setHealth({
                        status: 'error',
                        detail: e?.message || 'Health check failed',
                        proxy: null,
                        lastError: last ? {
                          url: last.url,
                          status: last.status,
                          statusText: last.statusText,
                          bodySnippet: last.bodySnippet
                        } : null
                      });
                    }
                  }}
                >
                  Run Health
                </button>
                {health.status === 'loading' && <span className="small">Checking...</span>}
                {health.status === 'ok' && (
                  <span className="small" style={{ color: '#10B981' }}>
                    OK: {health.detail} {health?.proxy ? `(proxy:${health.proxy.ok ? 'ok' : 'err'}, status:${health.proxy.status})` : ''}
                  </span>
                )}
                {health.status === 'error' && (
                  <span className="small" style={{ color: 'var(--error)' }}>
                    {health.detail}
                  </span>
                )}
              </div>
              {health.status === 'error' && health?.lastError && (
                <div className="small" style={{ marginTop: 8 }}>
                  <div><strong>Last error:</strong></div>
                  <div>URL: {String(health.lastError.url || '')}</div>
                  <div>Status: {String(health.lastError.status)} {String(health.lastError.statusText || '')}</div>
                  <div>Body: {(health.lastError.bodySnippet || '').slice(0, 200)}</div>
                </div>
              )}
            </div>
          </div>
          {!isConfigured && (
            <div className="small" style={{ marginTop: 8, color: '#F59E0B' }}>
              Tip: Fill REACT_APP_JIRA_* in .env and restart npm start. Demo mode shows mock data if not configured.
            </div>
          )}
          {proxyActive ? (
            <div className="small" style={{ marginTop: 8 }}>
              Note: The dev proxy injects Basic Auth on the server side and bypasses browser CORS.
            </div>
          ) : (
            <div className="small" style={{ marginTop: 8, color: '#F59E0B' }}>
              Warning: Direct Jira API calls from browser often fail due to CORS. Use the dev proxy (src/setupProxy.js).
            </div>
          )}
        </Card>
      )}

      <Card title="Controls" subtitle="Select project, board, and sprint" className="card-accent-amber">
        {kanbanNotice && (
          <div className="neon-badge neon-badge--warning" style={{ marginBottom: 8 }}>
            {kanbanNotice}
          </div>
        )}
        <div className="grid grid-3">
          <div className="col">
            <label className="small" htmlFor="projectKey">Project Key</label>
            <input
              id="projectKey"
              className="input"
              placeholder="e.g., CRYPTO"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
            />
            <div className="small">Default: {env.projectKey || 'N/A'}</div>
          </div>

          <div className="col">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="small" htmlFor="board">Board</label>
              <div className="row">
                <ToggleButton
                  active={showAllBoards}
                  onToggle={() => setShowAllBoards(v => !v)}
                  onLabel="Show all boards"
                  offLabel="Only Scrum"
                />
              </div>
            </div>
            <select
              id="board"
              className="select"
              value={selectedBoard}
              onChange={(e) => { setSelectedBoard(e.target.value); setSelectedSprint(''); }}
              disabled={boardsLoading}
            >
              <option value="">Select board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b?.supportsSprints === false ? ' (No sprints)' : ''}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-sm" onClick={refetchBoards} disabled={!projectKey && !env.projectKey || boardsLoading}>
                Reload Boards
              </button>
              {(boardsError) && <span className="small" style={{ color: 'var(--error)' }}>
                {boardsError}
              </span>}
            </div>
          </div>

          <div className="col">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="small" htmlFor="sprint">Sprint</label>
              <div className="row">
                <ToggleButton
                  active={sprintlessMode}
                  onToggle={() => setSprintlessMode(v => !v)}
                  onLabel="Sprintless mode"
                  offLabel="Sprintless mode"
                />
              </div>
            </div>
            <select
              id="sprint"
              className="select"
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              disabled={!selectedBoard || sprintsLoading || sprintlessMode}
            >
              <option value="">Select active sprint</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.startDate ? `(${new Date(s.startDate).toLocaleDateString()} - ${new Date(s.endDate).toLocaleDateString()})` : ''}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={refetchSprints} disabled={!selectedBoard || sprintsLoading || sprintlessMode}>
                Reload Sprints
              </button>
              {sprintsError && <span className="small" style={{ color: 'var(--error)' }}>{sprintsError}</span>}
              {sprintlessMode && (
                <div className="row" style={{ gap: 6 }}>
                  <label className="small" htmlFor="rangeStart">Start</label>
                  <input id="rangeStart" type="date" className="input" value={toDateInput(rangeStart)} onChange={(e) => setRangeStart(fromDateInput(e.target.value))} />
                  <label className="small" htmlFor="rangeEnd">End</label>
                  <input id="rangeEnd" type="date" className="input" value={toDateInput(rangeEnd)} onChange={(e) => setRangeEnd(fromDateInput(e.target.value))} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="spacer-md" />
        <button className="btn btn-primary" onClick={handleLoad} disabled={loading || (!sprintlessMode && !canLoad)}>
          {loading ? 'Loading...' : 'Load Burndown'}
        </button>
      </Card>

      {error && <ErrorState message={error} onRetry={handleLoad} />}

      <Card title={sprintlessMode ? 'Burndown Chart (Sprintless by issue count)' : 'Burndown Chart'} subtitle={sprintlessMode ? 'Remaining issues by count over selected date range' : 'Remaining vs Ideal'} className="card-accent-emerald">
        {!loading && !hasChart && (
          <div className="small muted" style={{ textAlign: 'center', padding: 20 }}>
            {sprintlessMode
              ? 'Choose project and board, select a date range, then click "Load Burndown".'
              : 'Choose project, board, and sprint, then click "Load Burndown".'}
          </div>
        )}
        {loading && <Loading text="Loading Jira issues and computing burndown..." />}
        {!loading && hasChart && (
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndown}>
                <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(d) => new Date(d).toLocaleDateString()}
                  formatter={(v, n) => [v, n === 'remaining' ? 'Remaining' : 'Ideal']}
                />
                <Legend />
                <Line type="monotone" dataKey="remaining" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ideal" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Included Issues" subtitle="Issues and points considered in this burndown">
        <Table columns={issueColumns} data={issues} keyField="key" emptyText="No issues. Load a sprint first." />
      </Card>
    </div>
  );
}

function defaultStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/**
 * Sprintless burndown: count remaining issues per day (no story points) within range.
 * We consider an issue "remaining" if resolutiondate is null or after the day.
 */
function computeSprintlessBurndownByCount({ startDateISO, endDateISO, issues = [] }) {
  const days = enumerateDays(startDateISO, endDateISO);
  if (!days.length) return [];
  // Precompute resolution day for each issue (UTC date string) or null
  const normalized = issues.map((it) => {
    const res = it?.fields?.resolutiondate || it?.resolutiondate || null;
    return { resolvedDay: res ? toDayISO(res) : null };
  });
  const total = normalized.length;
  const len = days.length;
  let remaining = total;
  const completionByDay = new Map();
  normalized.forEach((it) => {
    if (!it.resolvedDay) return;
    if (it.resolvedDay >= days[0] && it.resolvedDay <= days[len - 1]) {
      completionByDay.set(it.resolvedDay, (completionByDay.get(it.resolvedDay) || 0) + 1);
    }
  });

  const data = [];
  days.forEach((d, idx) => {
    const dec = completionByDay.get(d) || 0;
    remaining = Math.max(0, remaining - dec);
    const ideal = total * (1 - idx / (len - 1 || 1));
    data.push({ date: d, remaining, ideal: Math.round(ideal * 100) / 100 });
  });
  return data;
}

function enumerateDays(startISO, endISO) {
  const out = [];
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur.getTime() <= last.getTime()) {
    out.push(toDayISO(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function toDayISO(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateInput(iso) {
  // Convert YYYY-MM-DD or ISO to yyyy-mm-dd
  const s = toDayISO(iso);
  return s;
}

function fromDateInput(v) {
  // v is yyyy-mm-dd, convert to UTC midnight ISO
  if (!v) return defaultStartISO();
  const [y, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).toISOString();
}

function defaultEndISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
