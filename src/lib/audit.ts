import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { AuditLog } from '../types';

export const createAuditLog = async (
  targetId: string,
  targetName: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  changes?: AuditLog['changes']
) => {
  const user = auth.currentUser;
  
  const auditLog = {
    id: crypto.randomUUID(),
    target_id: targetId,
    target_name: targetName,
    action,
    changed_by: user?.displayName || user?.email || 'Sistema',
    changed_by_id: user?.uid || 'system',
    timestamp: new Date().toISOString(),
    changes: changes && changes.length > 0 ? changes : null
  };

  try {
    console.log('Sending audit log:', auditLog);
    await setDoc(doc(db, 'audit_logs', auditLog.id), auditLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${auditLog.id}`);
  }
};

export const getChanges = <T extends Record<string, any>>(
  oldData: T | undefined,
  newData: T,
  fieldsToCompare: (keyof T)[]
): AuditLog['changes'] => {
  if (!oldData) return undefined;

  const changes: AuditLog['changes'] = [];
  
  fieldsToCompare.forEach(field => {
    if (oldData[field] !== newData[field]) {
      changes.push({
        field: String(field),
        oldValue: oldData[field] === undefined || oldData[field] === null ? 'N/A' : oldData[field],
        newValue: newData[field] === undefined || newData[field] === null ? 'N/A' : newData[field]
      });
    }
  });

  return changes.length > 0 ? changes : undefined;
};
