// TODO: set USE_MOCK to false and supply ACTIVITY_API_URL when backend is available
const USE_MOCK = true;
const ACTIVITY_API_URL = 'http://localhost:3001';
const MOCK_URL = '/static/mock-activity.json';

const fetchActivity = async function (activityId) {
    if (USE_MOCK) {
        const res = await fetch(MOCK_URL);
        if (!res.ok) throw new Error(`Mock fetch failed: ${res.status}`);
        return res.json();
    }
    const res = await fetch(`${ACTIVITY_API_URL}/activities/${activityId}`);
    if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`);
    return res.json();
};

export {fetchActivity};
