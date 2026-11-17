const https = require('https');

function fetchAniList(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query, variables });
    const req = https.request(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'NekoPress-Intelligence/2.0 (Live News & Anime Wire)',
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.errors) {
              console.log('AniList error:', json.errors);
              reject(new Error(json.errors[0]?.message || 'AniList GraphQL Error'));
            } else {
              resolve(json.data);
            }
          } catch (e) {
            console.log('Status was:', res.statusCode, data);
            reject(new Error('JSON parse error'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const studioMediaQuery = `
  query ($studioId: Int) {
    Studio(id: $studioId) {
      id
      name
      media(sort: [POPULARITY_DESC, SCORE_DESC], perPage: 25) {
        nodes {
          id
          idMal
          title { romaji english }
          averageScore
          status
        }
      }
    }
  }
`;

async function main() {
  try {
    const data = await fetchAniList(studioMediaQuery, { studioId: 569 }); // MAPPA
    console.log('MAPPA nodes:', data?.Studio?.media?.nodes?.length);
    console.log('Sample node:', data?.Studio?.media?.nodes?.[0]);
  } catch (e) {
    console.error('Error caught:', e.message);
  }
}
main();
