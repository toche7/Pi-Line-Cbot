/** Staff permissions are separate from customer LINE admission. */
export const staffRoles = ['staff', 'content', 'admin'] as const;
export type StaffRole = typeof staffRoles[number];
export const extraPermissions = ['news.send', 'knowledge.publish', 'line.approve'] as const;
export type ExtraPermission = typeof extraPermissions[number];
export type Permission = 'work.read' | 'work.write' | 'conversation.takeover' | 'news.draft'
  | 'knowledge.draft' | 'bot.manage' | 'room.manage' | 'line.connection.manage' | 'ai.manage' | 'system.inspect' | 'staff.manage' | ExtraPermission;
export const roleLabels: Record<StaffRole, string> = { staff: 'เจ้าหน้าที่', content: 'ผู้จัดการ', admin: 'ผู้ดูแลระบบ' };
export type StaffPrincipal = { subject: string; email: string; role: StaffRole; enabled: boolean; extras: ExtraPermission[] };
const staffPermissions = ['work.read', 'work.write', 'conversation.takeover'] as const;
const managerPermissions = [
  ...staffPermissions, 'news.draft', 'news.send', 'knowledge.draft', 'knowledge.publish',
  'line.approve', 'system.inspect', 'room.manage',
] as const;
const baseline: Record<StaffRole, readonly Permission[]> = {
  staff: staffPermissions,
  content: managerPermissions,
  admin: [...managerPermissions, 'bot.manage', 'staff.manage', 'ai.manage', 'line.connection.manage'],
};
export function hasPermission(principal: StaffPrincipal | undefined, permission: Permission): boolean {
  if (!principal?.enabled || !staffRoles.includes(principal.role)) return false;
  return baseline[principal.role].includes(permission)
    || (extraPermissions as readonly string[]).includes(permission) && principal.extras.includes(permission as ExtraPermission)
      && (permission !== 'knowledge.publish' || principal.role === 'content');
}
export function visibleSettings(principal: StaffPrincipal | undefined) {
  return ([['profile', 'bot.manage'], ['line', 'line.connection.manage'], ['knowledge', 'knowledge.draft'], ['ai', 'ai.manage'], ['system', 'system.inspect'], ['users', 'staff.manage']] as const)
    .filter(([, permission]) => hasPermission(principal, permission)).map(([section]) => section);
}
