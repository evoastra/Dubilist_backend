const http = require('http');

const url = 'http://localhost:3000/uploads/categories/1_1775184981399_6anmge.jpeg';

http.get(url, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  res.on('data', (chunk) => {
    console.log('Received data chunk of size:', chunk.length);
  });
}).on('error', (e) => {
  console.error('Error:', e.message);
});
