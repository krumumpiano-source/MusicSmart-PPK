// MusicSmart PPK • Cloudflare Worker API (D1)
// Thin router dispatching to modular route handlers under ./routes/

import {
  HttpError,
  nowIso,
  normSid,
  readJson,
  json,
  corsHeaders
} from './utils.js';
import {
  requireAuth,
  authSetup,
  authLogin,
  authLogout,
  authChangePassword,
  studentLogin,
  studentLookup,
  listStudents,
  resetPin
} from './routes/auth.js';
import {
  putSession,
  listSessions,
  putSubmission,
  listSubmissions,
  patchSubmission,
  checkLink,
  mySubmissions,
  putResearch,
  listResearch,
  listRubrics,
  listCurriculumLessons,
  syncOps,
  setDueDate,
  listDueDates,
  postNotices,
  myNotices,
  syncBatch
} from './routes/classroom.js';
import {
  validUnit,
  putQuizBank,
  getQuiz,
  submitQuiz,
  listQuizAttempts,
  grantQuiz,
  putExamBank,
  openExam,
  closeExamSession,
  listExamSessions,
  examResults,
  grantExam,
  examStatus,
  examStart,
  examDraft,
  examSubmit
} from './routes/assessments.js';
import {
  internIdOf,
  internRegister,
  internLogin,
  internAuth,
  internFetch,
  internProposeGrades,
  internPostLog,
  listInterns,
  upsertIntern,
  decideIntern,
  resetInternPin,
  listInternApprovals,
  decideInternApproval,
  listInternLogs,
  postInternSupervision
} from './routes/interns.js';
import {
  studentLyricGet,
  studentLyricSave,
  studentLyricVote,
  teacherLyricOverview,
  teacherLyricSet,
  teacherLyricPick
} from './routes/lyrics.js';
import {
  pinResetRequest,
  listPinResets,
  decidePinReset,
  pinResetConfirm
} from './routes/pin-reset.js';

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = request.method;

  if (path === '/api/health' && m === 'GET') {
    return json({ ok: true, service: 'musicsmart-api', time: nowIso() });
  }
  if (path === '/api/auth/setup' && m === 'POST') return authSetup(request, env);
  if (path === '/api/auth/login' && m === 'POST') return authLogin(request, env);
  if (path === '/api/auth/logout' && m === 'POST') return authLogout(env, await requireAuth(request, env, ['teacher', 'student']));
  if (path === '/api/auth/change-password' && m === 'POST') return authChangePassword(request, env, await requireAuth(request, env, ['teacher']));
  if (path === '/api/auth/student' && m === 'POST') return studentLogin(request, env);
  if (path === '/api/auth/student-lookup' && m === 'POST') return studentLookup(request, env);

  if (path === '/api/me' && m === 'GET') {
    const a = await requireAuth(request, env, ['teacher', 'student']);
    return json({ role: a.role, sub: a.sub, class_name: a.class_name || null, student_id: a.sid || null });
  }

  if (path === '/api/students' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listStudents(env, url);
  }
  const rp = /^\/api\/teacher\/students\/([^/]+)\/reset-pin$/.exec(path);
  if (rp && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    return resetPin(env, a, normSid(decodeURIComponent(rp[1])));
  }

  if (path === '/api/sessions' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listSessions(env, url);
  }
  const sp = /^\/api\/sessions\/([^/]+)$/.exec(path);
  if (sp && m === 'PUT') {
    const a = await requireAuth(request, env, ['teacher']);
    const b = await readJson(request);
    const r = await putSession(env, a, { ...b, session_key: decodeURIComponent(sp[1]) });
    if (r.conflict) {
      return json({ error: 'version_conflict', message: 'ข้อมูลถูกแก้ไขจากที่อื่นแล้ว', current_version: r.current_version }, 409);
    }
    return json(r);
  }

  if (path === '/api/submissions' && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher', 'student']);
    return json(await putSubmission(env, a, await readJson(request)));
  }
  if (path === '/api/submissions' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listSubmissions(env, url);
  }
  if (path === '/api/submissions/mine' && m === 'GET') {
    const a = await requireAuth(request, env, ['student']);
    return mySubmissions(env, a);
  }
  const sub = /^\/api\/submissions\/([^/]+)$/.exec(path);
  if (sub && m === 'PATCH') {
    await requireAuth(request, env, ['teacher']);
    return json({ ok: true, submission: await patchSubmission(env, sub[1], await readJson(request)) });
  }
  const chk = /^\/api\/submissions\/([^/]+)\/check$/.exec(path);
  if (chk && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json({ ok: true, ...(await checkLink(env, chk[1])) });
  }

  if (path === '/api/research' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listResearch(env, url);
  }
  if (path === '/api/research' && m === 'PUT') {
    await requireAuth(request, env, ['teacher']);
    return json(await putResearch(env, await readJson(request)));
  }

  if (path === '/api/rubrics' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listRubrics(env, url);
  }
  if (path === '/api/curriculum-lessons' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listCurriculumLessons(env, url);
  }

  if (path === '/api/sync' && m === 'POST') return syncOps(request, env);

  if (path === '/api/due-dates' && m === 'GET') {
    const a = await requireAuth(request, env, ['teacher', 'student']);
    return listDueDates(env, a, url);
  }
  if (path === '/api/due-dates' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await setDueDate(env, await readJson(request)));
  }
  if (path === '/api/notices' && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    const b = await readJson(request);
    return json(await postNotices(env, a, b.items));
  }
  if (path === '/api/notices/mine' && m === 'GET') {
    const a = await requireAuth(request, env, ['student']);
    return myNotices(env, a, url);
  }
  if (path === '/api/sync/batch' && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    return syncBatch(request, env, a);
  }

  const qu = /^\/api\/quiz\/units\/(\d+)$/.exec(path);
  if (qu && m === 'GET') {
    await requireAuth(request, env, ['teacher', 'student']);
    return getQuiz(env, validUnit(qu[1]));
  }
  const qs = /^\/api\/quiz\/units\/(\d+)\/submit$/.exec(path);
  if (qs && m === 'POST') {
    const a = await requireAuth(request, env, ['student']);
    return submitQuiz(env, a, validUnit(qs[1]), await readJson(request));
  }
  if (path === '/api/quiz/bank' && m === 'PUT') {
    await requireAuth(request, env, ['teacher']);
    return json(await putQuizBank(env, await readJson(request)));
  }
  if (path === '/api/quiz/attempts' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listQuizAttempts(env, url);
  }
  if (path === '/api/quiz/grants' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await grantQuiz(env, await readJson(request)));
  }

  if (path === '/api/intern/register' && m === 'POST') return json(await internRegister(env, await readJson(request)));
  if (path === '/api/intern/login' && m === 'POST') return json(await internLogin(request, env, await readJson(request), false));
  if (path === '/api/intern/set-pin' && m === 'POST') return json(await internLogin(request, env, await readJson(request), true));
  if (path === '/api/intern/fetch' && m === 'GET') {
    const rec = await internAuth(env, await requireAuth(request, env, ['intern']));
    return internFetch(env, rec, url);
  }
  if (path === '/api/intern/grades' && m === 'POST') {
    const rec = await internAuth(env, await requireAuth(request, env, ['intern']));
    return json(await internProposeGrades(env, rec, await readJson(request)));
  }
  if (path === '/api/intern/logs' && m === 'POST') {
    const rec = await internAuth(env, await requireAuth(request, env, ['intern']));
    return json(await internPostLog(env, rec, await readJson(request)));
  }
  if (path === '/api/interns' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return json(await listInterns(env));
  }
  if (path === '/api/interns/approvals' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return json(await listInternApprovals(env, url));
  }
  if (path === '/api/interns/logs' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return json(await listInternLogs(env, url));
  }
  const ia = /^\/api\/interns\/approvals\/([^/]+)\/decide$/.exec(path);
  if (ia && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await decideInternApproval(env, decodeURIComponent(ia[1]).slice(0, 60), await readJson(request)));
  }
  const ii = /^\/api\/interns\/([^/]+)(?:\/(decide|reset-pin|supervision))?$/.exec(path);
  if (ii) {
    const subPath = ii[2] || '';
    const wanted = subPath ? 'POST' : 'PUT';
    if (m === wanted) {
      await requireAuth(request, env, ['teacher']);
      const id = internIdOf(decodeURIComponent(ii[1]));
      if (subPath === 'decide') return json(await decideIntern(env, id, await readJson(request)));
      if (subPath === 'reset-pin') return json(await resetInternPin(env, id));
      if (subPath === 'supervision') return json(await postInternSupervision(env, id, await readJson(request)));
      return json(await upsertIntern(env, id, await readJson(request)));
    }
  }

  if (path === '/api/exams/bank' && m === 'PUT') {
    await requireAuth(request, env, ['teacher']);
    return json(await putExamBank(env, await readJson(request)));
  }
  if (path === '/api/exams/sessions' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return listExamSessions(env, url);
  }
  if (path === '/api/exams/sessions' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await openExam(env, await readJson(request)));
  }
  const ec = /^\/api\/exams\/sessions\/([^/]+)\/close$/.exec(path);
  if (ec && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await closeExamSession(env, decodeURIComponent(ec[1]).slice(0, 60)));
  }
  if (path === '/api/exams/results' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return examResults(env, url);
  }
  if (path === '/api/exams/grants' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await grantExam(env, await readJson(request)));
  }
  if (path === '/api/exams/status' && m === 'GET') {
    return examStatus(env, await requireAuth(request, env, ['student']));
  }
  if (path === '/api/exams/start' && m === 'POST') {
    return examStart(env, await requireAuth(request, env, ['student']));
  }
  if (path === '/api/exams/draft' && m === 'PUT') {
    const a = await requireAuth(request, env, ['student']);
    return examDraft(env, a, await readJson(request));
  }
  if (path === '/api/exams/submit' && m === 'POST') {
    const a = await requireAuth(request, env, ['student']);
    return examSubmit(env, a, await readJson(request));
  }

  if (path === '/api/pin-reset/request' && m === 'POST') return json(await pinResetRequest(request, env, await readJson(request)));
  if (path === '/api/pin-reset/confirm' && m === 'POST') return json(await pinResetConfirm(request, env, await readJson(request)));
  if (path === '/api/pin-reset/requests' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return json(await listPinResets(env));
  }
  const pd = /^\/api\/pin-reset\/requests\/([^/]+)\/decide$/.exec(path);
  if (pd && m === 'POST') {
    const a = await requireAuth(request, env, ['teacher']);
    return json(await decidePinReset(env, a, decodeURIComponent(pd[1]).slice(0, 60), await readJson(request)));
  }

  if (path === '/api/lyrics/me') {
    const a = await requireAuth(request, env, ['student']);
    if (m === 'GET') return json(await studentLyricGet(env, a, url));
    if (m === 'PUT') return json(await studentLyricSave(env, a, await readJson(request)));
  }
  if (path === '/api/lyrics/vote' && m === 'POST') {
    const a = await requireAuth(request, env, ['student']);
    return json(await studentLyricVote(env, a, await readJson(request)));
  }
  if (path === '/api/lyrics/overview' && m === 'GET') {
    await requireAuth(request, env, ['teacher']);
    return json(await teacherLyricOverview(env, url));
  }
  if (path === '/api/lyrics/settings' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await teacherLyricSet(env, await readJson(request)));
  }
  if (path === '/api/lyrics/pick' && m === 'POST') {
    await requireAuth(request, env, ['teacher']);
    return json(await teacherLyricPick(env, await readJson(request)));
  }

  return json({ error: 'not_found', message: 'ไม่พบเส้นทาง' }, 404);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(request, env);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.code, message: e.message }, e.status, cors);
      }
      console.error('server_error', e && e.stack ? e.stack : String(e));
      return json({ error: 'server_error', message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' }, 500, cors);
    }
  }
};
