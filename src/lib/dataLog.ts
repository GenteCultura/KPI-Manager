import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { DataLog, DataLogType } from '../types';
import { toSnakeCase } from './mapping';

export const createDataLog = async (
  type: DataLogType,
  entity: DataLog['entity'],
  action: string,
  options: {
    fileName?: string;
    rowCount?: number;
    status?: 'SUCCESS' | 'ERROR' | 'PARTIAL';
    details?: string;
  } = {}
) => {
  const user = auth.currentUser;
  
  const dataLog: DataLog = {
    id: crypto.randomUUID(),
    type,
    entity,
    action,
    fileName: options.fileName,
    rowCount: options.rowCount,
    performedBy: user?.displayName || user?.email || 'Sistema',
    performedById: user?.uid || 'system',
    timestamp: new Date().toISOString(),
    status: options.status || 'SUCCESS',
    details: options.details || null
  };

  try {
    console.log('Sending data log:', dataLog);
    await setDoc(doc(db, 'data_logs', dataLog.id), toSnakeCase(dataLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `data_logs/${dataLog.id}`);
  }
};
