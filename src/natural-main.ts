import { runNaturalChat } from './natural-chat.js';
import { DemoFailure } from './diagnostics.js';

const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--rules-first', '--line-direct', '--line-group', '--grounded'].includes(arg))
  || args.includes('--line-direct') && args.includes('--line-group')
  || args.includes('--rules-first') && (args.includes('--line-direct') || args.includes('--line-group') || args.includes('--grounded'))) {
  console.error('ใช้ npm run chat:natural, npm run chat:line, npm run chat:group, chat:line:next, chat:group:next หรือเพิ่ม -- --check เพื่อตรวจโดยไม่เรียกโมเดล');
  process.exitCode = 1;
} else {
  runNaturalChat({ checkOnly: args.includes('--check'), mode: args.includes('--rules-first') ? 'rules-first' : 'grounded',
    channel: args.includes('--line-group') ? 'line-group' : args.includes('--line-direct') ? 'line-direct' : 'terminal' })
    .catch(error => {
      console.error(error instanceof DemoFailure ? error.message : 'เริ่มแชตทดลองไม่สำเร็จ ตรวจ config บนเครื่อง ไม่แสดงรายละเอียดที่อาจมี credentials');
      process.exitCode = 1;
    });
}
