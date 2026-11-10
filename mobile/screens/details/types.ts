export type ReportKind = 'operations' | 'expenses' | 'contracts';
export type PeopleStackParamList = {
  PeopleList: undefined;
  LabourDetail: { id: string };
  TeamDetail: { id: string };
};

export type OperationsStackParamList = {
  OperationsList: undefined;
  OperationDetail: { id: string };
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Payments: undefined;
  Contracts: undefined;
  ContractDetail: { id: string };
  Statements: undefined;
  StatementDetail: { entityType: string; entityId: string; name: string } | undefined;
  StatementReport: { kind: ReportKind };
  Plots: undefined;
  Expenses: { plotId?: string; date?: string; operationId?: string; kind?: 'expense' | 'income' } | undefined;
  Settings: undefined;
};
