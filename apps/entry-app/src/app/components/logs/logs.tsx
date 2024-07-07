// import { CONFIG } from 'apps/entry-app/src/config';
// import React, { useEffect, useState } from 'react';

// export const Logs = () => {
//   const [logs, setLogs] = useState([]);

//   useEffect(() => {
//     const fetchLogs = async () => {
//       const accessToken = localStorage.getItem('accessToken');
//       try {
//         const data = await fetch(`${CONFIG.BE_URL}/logs`, {
//           method: 'GET',
//           headers: {
//             Authorization: `Bearer ${accessToken}`,
//           },
//         });
//       } catch (e) {
//         console.log('error happened during fetch');
//       }
//     };
//     fetchLogs();
//   }, []);

//   return <div>logs</div>;
// };
