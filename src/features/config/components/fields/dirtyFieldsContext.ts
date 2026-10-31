import { createContext } from 'react';

export const ConfigDirtyFieldsContext = createContext<ReadonlySet<string>>(new Set());
