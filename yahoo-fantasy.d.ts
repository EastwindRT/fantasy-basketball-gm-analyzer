declare module 'yahoo-fantasy' {
  export default class YahooFantasy {
    constructor(clientId: string, clientSecret: string);
    setUserToken(token: string): void;
    league: {
      meta(leagueKey: string): Promise<any>;
      standings(leagueKey: string): Promise<any>;
      transactions(leagueKey: string): Promise<any>;
      draft_results(leagueKey: string): Promise<any>;
      scoreboard(leagueKey: string, week?: number): Promise<any>;
      settings(leagueKey: string): Promise<any>;
    };
  }
}
