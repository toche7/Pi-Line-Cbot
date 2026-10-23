import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { CourseRequestStore } from './course-requests.js';
import { requestsAdminHandler } from './requests-admin.js';

const port = Number(process.env.REQUESTS_ADMIN_PORT || '3002');
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid requests admin port');
const server = createServer(requestsAdminHandler(new CourseRequestStore(resolve('runtime/course-requests'))));
server.requestTimeout = 10000; server.headersTimeout = 10000;
server.on('error', () => { console.error('เปิดหน้าคำขอกลางไม่สำเร็จ ตรวจพอร์ตและสิทธิ์ไฟล์'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`คำขอกลาง: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { server.close(); server.closeAllConnections(); });
