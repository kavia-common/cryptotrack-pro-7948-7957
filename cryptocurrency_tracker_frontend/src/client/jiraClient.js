//
// Lightweight Jira client for browser use (with MOCK fallback).
// WARNING: Frontend cannot securely store secrets. Prefer a backend proxy.
// This client supports Basic Auth for Jira Cloud with strict precautions:
// - Never log Authorization or token/email.
// - Use environment variables prefixed with REACT_APP_ for CRA.
//
// Env (CRA):
//   REACT_APP_JIRA_SITE_DOMAIN
//   REACT_APP_JIRA_PROJECT_KEY
//   REACT_APP_JIRA_EMAIL
//   REACT_APP_JIRA_API_TOKEN
//
 // PUBLIC_INTERFACE
export const JiraEnv = {
  /** Returns env vars safely from process.env (CRA). */
  get() {
    const site = process.env.REACT_APP_JIRA_SITE_DOMAIN || '';
    const projectKey = process.env.REACT_APP_JIRA_PROJECT_KEY || '';
    const email = process.env.REACT_APP_JIRA_EMAIL || '';
    const token = process.env.REACT_APP_JIRA_API_TOKEN || '';
    return { site, projectKey, email, token };
  },
  /** True if all required env vars are present. */
  isConfigured() {
    const { site, projectKey, email, token } = JiraEnv.get();
    return Boolean(site && projectKey && email && token);
  },
  /** Base URL like https://your-company.atlassian.net */
  baseUrl() {
    const { site } = JiraEnv.get();
    if (!site) return '';
    const hasProtocol = site.startsWith('http://') || site.startsWith('https://');
    return hasProtocol ? site.replace(/^http:\/\//i, 'https://') : `https://${site}`;
  },
  /**
   * Build an API URL preferring the /jira proxy when available.
   * Example: apiPath('/rest/api/3/field') => '/jira/rest/api/3/field' in dev, or 'https://site/rest/api/3/field' in prod.
   */
  apiPath(path) {
    const clean = path.startsWith('/') ? path : `/${path}`;
    return shouldUseProxy() ? `/jira${clean}` : `${JiraEnv.baseUrl()}${clean}`;
  },
};

/**
 * INTERNAL: Build safe auth header; never log it.
 * Note: In development we prefer to rely on the CRA dev proxy injecting Authorization server-side.
 * We still include Authorization here to support non-proxy environments (e.g., production demo or custom backend).
 */
function buildAuthHeader() {
  const { email, token } = JiraEnv.get();
  if (!email || !token) return {};
  const basic = btoa(`${email}:${token}`);
  return { Authorization: `Basic ${basic}` };
}

let lastJiraError = null;
export function getLastJiraError() {
  // PUBLIC_INTERFACE
  /** Returns last Jira error object captured by client, or null. */
  return lastJiraError;
}

// INTERNAL: Safe fetch wrapper that masks secrets in errors.
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      // Never include credentials/cookies to Jira to avoid XSRF/cookie auth paths
      credentials: 'omit',
    });
    if (!res.ok) {
      let msg = `Jira API error: ${res.status} ${res.statusText}`.trim();
      let bodyText = '';
      try {
        bodyText = await res.text();
        if (bodyText) {
          msg += ` • ${truncate(bodyText, 300)}`;
        }
      } catch {
        // ignore
      }
      if (res.status === 401) {
        msg += ' • 401 Unauthorized. Check REACT_APP_JIRA_EMAIL/API_TOKEN, user permissions, and that the API token is valid.';
      }
      if (res.status === 403) {
        msg += ' • 403 Forbidden (likely XSRF/auth). The dev proxy must inject Basic auth and strip cookies. Ensure all calls go through /jira/rest/... (not direct domain) and that no cookies are sent.';
        if (shouldUseProxy()) {
          msg += ' • Using /jira proxy: verify .env REACT_APP_JIRA_* and restart `npm start`.';
        } else {
          msg += ' • Not using proxy: browser CORS may block requests. Use the dev proxy or a backend proxy.';
        }
      }
      lastJiraError = {
        url,
        status: res.status,
        statusText: res.statusText,
        bodySnippet: truncate(bodyText, 300),
        ts: Date.now(),
      };
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    lastJiraError = null;
    if (ct.includes('application/json')) {
      return res.json();
    }
    return res.text();
  } catch (e) {
    const raw = String(e?.message || '');
    let hint = '';
    if (/Failed to fetch|NetworkError|TypeError: fetch failed/i.test(raw)) {
      if (!shouldUseProxy()) {
        hint =
          ' • Possible CORS/network failure. In dev, enable the Jira dev proxy (src/setupProxy.js) or run through a backend.';
      } else {
        hint =
          ' • Possible proxy/network failure. Ensure src/setupProxy.js is active and .env has Jira site/email/token, then restart `npm start`.';
      }
    }
    const masked = (raw || 'Network error')
      .replaceAll(process.env.REACT_APP_JIRA_EMAIL || '', '[email]')
      .replaceAll(process.env.REACT_APP_JIRA_API_TOKEN || '', '[token]');
    lastJiraError = {
      url,
      status: 0,
      statusText: 'NETWORK',
      bodySnippet: masked.slice(0, 300),
      ts: Date.now(),
    };
    throw new Error(`${masked}${hint}`);
  }
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

/**
 * INTERNAL: decide if we should use the CRA dev proxy (/jira) in development.
 * Not a React hook, just an environment check.
 */
function shouldUseProxy() {
  const isDev = process.env.NODE_ENV !== 'production';
  const { site } = JiraEnv.get();
  return isDev && Boolean(site);
}

/**
 * INTERNAL: Attempt to probe if a board supports sprints by fetching sprints list.
 * Returns boolean and never throws; treats 400 "does not support sprints" as false.
 */
async function probeBoardSupportsSprints(boardId, signal) {
  try {
    const url = JiraEnv.apiPath(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?maxResults=1`);
    await safeFetch(url, {
      method: 'GET',
      headers: { ...buildAuthHeader() },
      signal,
    });
    return true;
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('does not support sprints') || msg.includes('400')) {
      return false;
    }
    // For other errors (network, auth), do not assert; return true to avoid hiding boards.
    return true;
  }
}

// PUBLIC_INTERFACE
export async function getBoards(projectKey, signal) {
  /**
   * Fetch boards for a project key using Jira Agile API.
   * GET /rest/agile/1.0/board?projectKeyOrId={projectKey}
   * Annotates each board with { supportsSprints: boolean, type?: 'scrum'|'kanban'|... } when possible.
   */
  if (!JiraEnv.isConfigured()) {
    // Mock boards with one scrum-like and one kanban-like for demo UX
    return {
      values: [
        { id: 101, name: `Demo Scrum Board (${projectKey || 'DEMO'})`, type: 'scrum', supportsSprints: true },
        { id: 102, name: `Demo Kanban Board (${projectKey || 'DEMO'})`, type: 'kanban', supportsSprints: false },
      ],
    };
  }
  const url = JiraEnv.apiPath(`/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`);
  const base = await safeFetch(url, {
    method: 'GET',
    headers: { ...buildAuthHeader() },
    signal,
  });

  const values = Array.isArray(base?.values) ? base.values : [];
  // If Jira includes 'type', use it; otherwise, probe one-by-one (best-effort).
  const annotated = [];
  for (const b of values) {
    const type = b?.type || b?.typeName || '';
    let supports = typeof b?.supportsSprints === 'boolean' ? b.supportsSprints : undefined;

    if (typeof supports !== 'boolean') {
      if (String(type).toLowerCase() === 'scrum') supports = true;
      else if (String(type).toLowerCase() === 'kanban') supports = false;
    }

    if (typeof supports !== 'boolean') {
      supports = await probeBoardSupportsSprints(b.id, signal);
    }

    annotated.push({ ...b, type, supportsSprints: !!supports });
  }

  return { ...base, values: annotated };
}

/**
 * PUBLIC_INTERFACE
 * Try to list sprints for a board with explicit error signaling for "no sprints".
 * If Jira returns 400 "board does not support sprints", return { values: [], error: { code: 'NO_SPRINTS' } }.
 */
export async function getSprints(boardId, { state = 'active' } = {}, signal) {
  if (!JiraEnv.isConfigured()) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 14);
    return {
      values: [
        { id: 201, name: 'Demo Sprint', state: 'active', startDate: start.toISOString(), endDate: end.toISOString() },
      ],
    };
  }
  const url = JiraEnv.apiPath(`/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?state=${encodeURIComponent(state)}`);
  try {
    const res = await safeFetch(url, {
      method: 'GET',
      headers: { ...buildAuthHeader() },
      signal,
    });
    return res;
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('does not support sprints') || msg.includes('400')) {
      return { values: [], error: { code: 'NO_SPRINTS', message: 'The board does not support sprints' } };
    }
    throw e;
  }
}

// PUBLIC_INTERFACE
export async function getActiveSprints(boardId, signal) {
  /**
   * Backward-compatible function to fetch only active sprints.
   * Uses getSprints and preserves shape.
   */
  const res = await getSprints(boardId, { state: 'active' }, signal);
  return res;
}

// INTERNAL: Try to detect Story Points field id by reading fields metadata.
// Fallback common id customfield_10016. If not present, return null to default later.
async function detectStoryPointsField(signal) {
  if (!JiraEnv.isConfigured()) return 'customfield_10016'; // plausible default for mock
  const url = JiraEnv.apiPath(`/rest/api/3/field`);
  const fields = await safeFetch(url, {
    method: 'GET',
    headers: { ...buildAuthHeader() },
    signal,
  });
  // Look for display names likely representing Story Points
  const candidates = ['Story Points', 'Story point estimate', 'Story Points estimate'];
  let match = null;
  for (const f of fields || []) {
    const name = (f?.name || '').toLowerCase();
    if (candidates.some((c) => name === c.toLowerCase() || name.includes('story') && name.includes('point'))) {
      match = f?.id || null;
      if (match) break;
    }
  }
  return match || 'customfield_10016';
}

// PUBLIC_INTERFACE
export async function searchIssuesJQL(jql, fields = ['summary', 'status', 'assignee', 'updated', 'resolutiondate'], signal) {
  /**
   * Search issues via Jira REST API v3 with JQL.
   * POST /rest/api/3/search { jql, fields }
   * Automatically includes the detected Story Points field if available.
   */
  if (!JiraEnv.isConfigured()) {
    // Return mock issues with points and a couple resolved
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);

    return {
      issues: [
        {
          id: 'D-1',
          key: 'DEMO-1',
          fields: {
            summary: 'Set up project scaffolding',
            status: { name: 'Done' },
            resolutiondate: fiveDaysAgo.toISOString(),
            updated: fiveDaysAgo.toISOString(),
            customfield_10016: 3,
          },
        },
        {
          id: 'D-2',
          key: 'DEMO-2',
          fields: {
            summary: 'Implement login flow',
            status: { name: 'In Progress' },
            updated: twoDaysAgo.toISOString(),
            customfield_10016: 5,
          },
        },
        {
          id: 'D-3',
          key: 'DEMO-3',
          fields: {
            summary: 'Create dashboard layout',
            status: { name: 'To Do' },
            updated: today.toISOString(),
            customfield_10016: 2,
          },
        },
      ],
    };
  }

  const spField = await detectStoryPointsField(signal);
  const fieldSet = Array.from(
    new Set([...fields, spField].filter(Boolean))
  );
  const url = JiraEnv.apiPath(`/rest/api/3/search`);
  const body = JSON.stringify({
    jql,
    fields: fieldSet,
    maxResults: 500,
  });
  return safeFetch(url, {
    method: 'POST',
    headers: { ...buildAuthHeader() },
    body,
    signal,
  });
}

export async function getMyself(signal) {
  /**
   * PUBLIC_INTERFACE
   * Health check endpoint to validate connectivity and auth.
   * Tries /jira/health (proxy-based) first, then falls back to /rest/api/3/myself.
   */
  if (!JiraEnv.isConfigured()) {
    // Demo health OK if not configured
    return { active: true, demo: true };
  }

  // Prefer proxy health when available
  if (shouldUseProxy()) {
    try {
      const health = await safeFetch('/jira/health', { method: 'GET', signal });
      return health;
    } catch (e) {
      // fall through to direct /myself via proxy path
    }
  }

  const url = JiraEnv.apiPath('/rest/api/3/myself');
  return safeFetch(url, {
    method: 'GET',
    headers: { ...buildAuthHeader() },
    signal,
  });
}

/**
 * PUBLIC_INTERFACE
 * Build a JQL string for sprintless burndown by counting remaining issues by date range.
 * Example base: project = KEY AND statusCategory != Done
 */
export function buildSprintlessJql(projectKey, extra = '') {
  const base = `project = ${projectKey} AND statusCategory != Done`;
  if (extra && String(extra).trim()) return `${base} AND (${extra})`;
  return base;
}

/**
 * PUBLIC_INTERFACE
 * Fetch issues for sprintless mode; the consumer should aggregate counts per day.
 * To keep payloads reasonable, limit fields set.
 */
export async function searchIssuesForSprintless(projectKey, extraJql = '', signal) {
  const jql = buildSprintlessJql(projectKey, extraJql);
  return searchIssuesJQL(jql, ['summary', 'status', 'updated', 'resolutiondate'], signal);
}

export function extractIssueInfo(issue, storyPointsFieldId = 'customfield_10016') {
  /**
   * Normalize essential fields from a Jira issue.
   * Returns: { key, summary, status, points, resolutiondate }
   */
  const f = issue?.fields || {};
  const points = typeof f[storyPointsFieldId] === 'number' ? f[storyPointsFieldId] : (
    typeof f['customfield_10016'] === 'number' ? f['customfield_10016'] : null
  );
  return {
    key: issue?.key,
    summary: f.summary,
    status: f.status?.name || '',
    points,
    resolutiondate: f.resolutiondate || null,
  };
}
