export interface ILoginPayload {
  username: string;
  password: string;
}

export interface ILoginResult {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface IRefreshPayload {
  refresh_token: string;
}

export interface ISetCredentialPayload {
  user_id: string;
  username: string;
  password: string;
}
