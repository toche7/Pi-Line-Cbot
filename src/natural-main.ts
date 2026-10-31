import { runNaturalChat } from './natural-chat.js';
import { DemoFailure } from './diagnostics.js';

const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--rules-first'].includes(arg))) {
  console.error('ใช้ npm run chat:natural [-- --rules-first] หรือ npm run check:natural');
  process.exitCode = 1;
} else {
  runNaturalChat({ checkOnly: args.includes('--check'), mode: args.includes('--rules-first') ? 'rules-first' : 'model-first' })
    .catch(error => {
      console.error(error instanceof DemoFailure ? error.message : 'เริ่มแชตทดลองไม่สำเร็จ ตรวจ config บนเครื่อง ไม่แสดงรายละเอียดที่อาจมี credentials');
      process.exitCode = 1;
    });
}
