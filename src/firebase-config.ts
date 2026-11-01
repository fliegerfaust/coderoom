// Конфиг Firebase. Публичный по устройству Firebase: доступ к данным ограничивают правила базы
// (database.rules.json — копия опубликованных правил), а не секретность этих строк.
// Realtime Database без входа нужен только адрес базы.
import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions | null = {
  projectId: 'denval-coderoom',
  databaseURL: 'https://denval-coderoom-default-rtdb.europe-west1.firebasedatabase.app',
};
