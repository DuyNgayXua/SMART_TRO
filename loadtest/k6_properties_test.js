import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

// Load CSV once and share across VUs
const csv = open('./properties.csv');
const data = new SharedArray('properties', function () {
  return csv
    .trim()
    .split('\n')
    .slice(1)
    .map(line => {
      // naive split; fields have no commas in our CSV
      const cols = line.split(',');
      return {
        title: cols[0],
        description: cols[1],
        price: Number(cols[2]) || 0,
        area: cols[3],
        bedrooms: Number(cols[4]) || 0,
        bathrooms: Number(cols[5]) || 0,
        city: cols[6]
      };
    });
});

export const options = {
  vus: 50,
  iterations: 50, // total 50 requests (1 per VU)
  thresholds: {
    // 95% of requests must be < 3000 ms
    'http_req_duration': ['p(95)<3000'],
    // error rate < 2%
    'http_req_failed': ['rate<0.02']
  }
};

export default function () {
  // Spread requests across 60s window so they happen within 1 minute
  sleep(Math.random() * 60);

  // Each VU picks a unique row by VU number
  const idx = (__VU - 1) % data.length;
  const payload = JSON.stringify(data[idx]);

  const url = `${__ENV.BASE_URL || 'http://localhost:3000'}/api/properties`;

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': __ENV.AUTH_TOKEN ? `Bearer ${__ENV.AUTH_TOKEN}` : ''
    },
    tags: { test: 'properties-bulk' }
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });
}
