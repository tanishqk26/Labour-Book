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
  Contracts: undefined;
  Statements: undefined;
  StatementDetail: { entityType: string; entityId: string; name: string };
};
