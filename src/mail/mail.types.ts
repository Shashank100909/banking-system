type VerificationCodeMailPayload = {
  username: string;
  code: string;
  expirationTime: string;
};

type DepositConfirmationMailPayload = {
  username: string;
  amount: number;
  balance: number;
  transactionId: number;
};

type WithdrawalConfirmationMailPayload = {
  username: string;
  amount: number;
  balance: number;
  transactionId: number;
};

type TransferConfirmationMailPayload = {
  username: string;
  amount: number;
  balance: number;
  receiverAccountId?: number;
  senderAccountId?: number;
  transactionId: number;
};

export type DepositConfirmationMailTemplate = {
  name: 'deposit-confirmation';
  data: DepositConfirmationMailPayload;
};

export type WithdrawalConfirmationMailTemplate = {
  name: 'withdrawal-confirmation';
  data: WithdrawalConfirmationMailPayload;
};

export type TransferConfirmationMailTemplate = {
  name: 'transfer-confirmation';
  data: TransferConfirmationMailPayload;
};

export type RegisterVerificationCodeMailTemplate = {
  name: 'register-verification-code';
  data: VerificationCodeMailPayload;
};

export type ResetPasswordVerificationCodeMailTemplate = {
  name: 'reset-password-verification-code';
  data: VerificationCodeMailPayload;
};

export type MailTemplate =
  | RegisterVerificationCodeMailTemplate
  | ResetPasswordVerificationCodeMailTemplate
  | DepositConfirmationMailTemplate
  | WithdrawalConfirmationMailTemplate
  | TransferConfirmationMailTemplate;

  
export type MailParams = { subject: string; template: MailTemplate };
