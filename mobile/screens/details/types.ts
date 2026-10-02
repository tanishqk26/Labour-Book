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
  StatementDetail: { entityType: string; entityId: string; name: string };
};
