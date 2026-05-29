(async () => {
  try {
    const base = 'http://localhost:3000';

    console.log('Creating offering...');
    let res = await fetch(`${base}/teachers/offerings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName: 'Math', title: 'Algebra 101', teacherId: 'teacher-1', teacherTimezone: 'America/Los_Angeles' })
    });
    const createResp = await res.json();
    console.log('Create response:', JSON.stringify(createResp, null, 2));

    const offeringId = createResp.offering?.id;
    if (!offeringId) throw new Error('No offering id in create response');

    console.log('Adding sessions...');
    res = await fetch(`${base}/teachers/offerings/${offeringId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: [{ startAt: '2026-06-10T10:00:00', endAt: '2026-06-10T11:00:00' }] })
    });
    const addResp = await res.json();
    console.log('Add sessions response:', JSON.stringify(addResp, null, 2));

    console.log("Booking offering as parent 'parent-1'...");
    res = await fetch(`${base}/parents/parent-1/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringId })
    });
    const bookResp = await res.json();
    console.log('Book response:', JSON.stringify(bookResp, null, 2));

    console.log("Listing bookings for parent-1...");
    res = await fetch(`${base}/parents/parent-1/bookings?timezone=America/Los_Angeles`);
    const listResp = await res.json();
    console.log('List response:', JSON.stringify(listResp, null, 2));

    console.log('Smoke test completed successfully');
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(1);
  }
})();
