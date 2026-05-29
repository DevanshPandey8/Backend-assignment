(async () => {
  const base = 'http://localhost:3000';
  const offeringId = '83062a80-b9c1-465d-b6bf-f0a3bd95299f';

  try {
    let res = await fetch(base + '/parents/parent-2/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offeringId })
    });

    console.log('POST status', res.status);
    console.log('POST body', JSON.stringify(await res.json(), null, 2));

    res = await fetch(base + '/parents/parent-2/bookings?timezone=America/Los_Angeles');
    console.log('GET status', res.status);
    console.log('GET body', JSON.stringify(await res.json(), null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
