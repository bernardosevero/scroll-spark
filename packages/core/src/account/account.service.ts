import type { AccountStatus } from "./schemas";

export interface AccountRepository {
  /**
   * Removes the user and, with them, every grant, capture and analysis. Removing someone who is
   * already gone is not an error.
   */
  deleteUser(userId: string): Promise<void>;
  needsReconnect(userId: string): Promise<boolean>;
}

export interface AccountService {
  status(userId: string): Promise<AccountStatus>;
  deleteMyData(userId: string): Promise<void>;
}

export function createAccountService({
  accounts,
}: {
  accounts: AccountRepository;
}): AccountService {
  return {
    async status(userId) {
      return { needsReconnect: await accounts.needsReconnect(userId) };
    },

    deleteMyData: (userId) => accounts.deleteUser(userId),
  };
}
