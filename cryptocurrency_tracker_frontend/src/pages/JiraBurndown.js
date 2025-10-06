import React, { useMemo, useState } from 'react';
import { Card, Loading, ErrorState, Table, ToggleButton } from '../components/ui';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { JiraEnv, getBoards, getActiveSprints, searchIssuesJQL, extractIssueInfo, getMyself } from '../client/jiraClient';
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
  const [useDemo, setUseDemo] = useState(!isConfigured); // default to demo if not configured
  const [burndown, setBurndown] = useState([]);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Diagnostics panel
  const [showDiag, setShowDiag] = useState(false);
  const [health, setHealth] = useState({ status: 'idle', detail: '' });

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

  const boards = Array.isArray(boardsData?.values) ? boardsData.values : [];

  // Sprints for selected board
  const sprintsKey = `jira:sprints:${selectedBoard}`;
  const { data: sprintsData, loading: sprintsLoading, error: sprintsError, refetch: refetchSprints } = useCachedFetch({
    key: selectedBoard ? sprintsKey : null,
    ttlMs: 60_000,
    fetcher: async (signal) => {
      if (!selectedBoard) return { values: [] };
      return getActiveSprints(selectedBoard, signal);
    },
    deps: [selectedBoard],
    immediate: !!selectedBoard,
  });

  const sprints = Array.isArray(sprintsData?.values) ? sprintsData.values : [];

  const selectedSprintObj = useMemo(() => {
    return sprints.find((s) => String(s.id) === String(selectedSprint));
  }, [sprints, selectedSprint]);

  const canLoad = Boolean((projectKey || env.projectKey) && selectedBoard && selectedSprint);

  async function handleLoad() {
    setLoading(true);
    setError('');
    setBurndown([]);
    setIssues([]);
    try {
      // Form JQL: sprint = active sprint id and project key
      const key = projectKey || env.projectKey || 'DEMO';
      const jql = `project = ${key} AND sprint = ${selectedSprint}`;
      const result = await searchIssuesJQL(jql, ['summary', 'status', 'assignee', 'updated', 'resolutiondate'], undefined);
      const storyPointsFieldId = 'customfield_10016'; // used by extract; dynamic detection handled in searchIssuesJQL
      const normalized = (result?.issues || []).map((it) => extractIssueInfo(it, storyPointsFieldId));
      setIssues(normalized);

      // Compute burndown using sprint dates
      const startISO = selectedSprintObj?.startDate || defaultStartISO();
      const endISO = selectedSprintObj?.endDate || defaultEndISO();
      const data = computeBurndown({
        startDateISO: startISO,
        endDateISO: endISO,
        issues: normalized,
        storyPointsFieldId,
      });
      setBurndown(data);
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
                      setHealth({ status: 'loading', detail: '' });
                      const res = await getMyself();
                      const who = res?.displayName || res?.emailAddress || res?.accountId || 'OK';
                      setHealth({ status: 'ok', detail: String(who) });
                    } catch (e) {
                      setHealth({ status: 'error', detail: e?.message || 'Health check failed' });
                    }
                  }}
                >
                  Run /myself
                </button>
                {health.status === 'loading' && <span className="small">Checking...</span>}
                {health.status === 'ok' && <span className="small" style={{ color: '#10B981' }}>OK: {health.detail}</span>}
                {health.status === 'error' && <span className="small" style={{ color: 'var(--error)' }}>{health.detail}</span>}
              </div>
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
            <label className="small" htmlFor="board">Board</label>
            <select
              id="board"
              className="select"
              value={selectedBoard}
              onChange={(e) => { setSelectedBoard(e.target.value); setSelectedSprint(''); }}
              disabled={boardsLoading}
            >
              <option value="">Select board</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
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
            <label className="small" htmlFor="sprint">Sprint</label>
            <select
              id="sprint"
              className="select"
              value={selectedSprint}
              onChange={(e) => setSelectedSprint(e.target.value)}
              disabled={!selectedBoard || sprintsLoading}
            >
              <option value="">Select active sprint</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.startDate ? `(${new Date(s.startDate).toLocaleDateString()} - ${new Date(s.endDate).toLocaleDateString()})` : ''}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-sm" onClick={refetchSprints} disabled={!selectedBoard || sprintsLoading}>
                Reload Sprints
              </button>
              {(sprintsError) && <span className="small" style={{ color: 'var(--error)' }}>{sprintsError}</span>}
            </div>
          </div>
        </div>

        <div className="spacer-md" />
        <button className="btn btn-primary" onClick={handleLoad} disabled={!canLoad || loading}>
          {loading ? 'Loading...' : 'Load Burndown'}
        </button>
      </Card>

      {error && <ErrorState message={error} onRetry={handleLoad} />}

      <Card title="Burndown Chart" subtitle="Remaining vs Ideal" className="card-accent-emerald">
        {!loading && !hasChart && (
          <div className="small muted" style={{ textAlign: 'center', padding: 20 }}>
            Choose project, board, and sprint, then click "Load Burndown".
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

function defaultEndISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
