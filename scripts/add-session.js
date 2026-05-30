(async () => {
  try {
    const base = 'http://localhost:3000';
    const teacherId = 'teacher-1';

    console.log('Fetching offerings for', teacherId);
    let r = await fetch(`${base}/teachers/${teacherId}/offerings`);
    if (!r.ok) throw new Error(`GET offerings failed: ${r.status}`);
    const list = await r.json();
    const offeringId = list.offerings?.[0]?.id;
    if (!offeringId) throw new Error('No offering found for teacher');
    console.log('Using offeringId', offeringId);

    const sessions = { sessions: [{ startAt: '2026-06-10T10:00:00', endAt: '2026-06-10T11:00:00' }] };
    r = await fetch(`${base}/teachers/offerings/${offeringId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessions)
    });

    console.log('POST status', r.status);
    console.log('Response:', JSON.stringify(await r.json(), null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
