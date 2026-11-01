/** Staff permissions are separate from customer LINE admission. */
export const staffRoles = ['staff', 'content', 'admin'] as const;
export type StaffRole = typeof staffRoles[number];
export const extraPermissions = ['news.send', 'knowledge.publish', 'line.approve'] as const;
export type ExtraPermission = typeof extraPermissions[number];
export type Permission = 'work.read' | 'work.write' | 'conversation.takeover' | 'news.draft'
  | 'knowledge.draft' | 'ai.manage' | 'system.inspect' | 'staff.manage' | ExtraPermission;
export const roleLabels: Record<StaffRole, string> = { staff: 'เจ้าหน้าที่', content: 'ผู้ดูแลเนื้อหา', admin: 'ผู้ดูแลระบบ' };
export type StaffPrincipal = { subject: string; email: string; role: StaffRole; enabled: boolean; extras: ExtraPermission[] };
const baseline: Record<StaffRole, readonly Permission[]> = {
  staff: ['work.read', 'work.write', 'conversation.takeover'],
  content: ['work.read', 'work.write', 'conversation.takeover', 'news.draft', 'knowledge.draft'],
  admin: ['work.read', 'work.write', 'conversation.takeover', 'news.draft', 'knowledge.draft',
    'news.send', 'knowledge.publish', 'line.approve', 'ai.manage', 'system.inspect', 'staff.manage'],
};
export function hasPermission(principal: StaffPrincipal | undefined, permission: Permission): boolean {
  if (!principal?.enabled || !staffRoles.includes(principal.role)) return false;
  return baseline[principal.role].includes(permission)
    || (extraPermissions as readonly string[]).includes(permission) && principal.extras.includes(permission as ExtraPermission)
      && (permission !== 'knowledge.publish' || principal.role === 'content');
}
export function visibleSettings(principal: StaffPrincipal | undefined) {
  return ([['knowledge', 'knowledge.draft'], ['ai', 'ai.manage'], ['system', 'system.inspect'], ['users', 'staff.manage']] as const)
    .filter(([, permission]) => hasPermission(principal, permission)).map(([section]) => section);
}
