import { BaseAgent, AgentConfig } from '../base-agent';
declare class ScalpingBot extends BaseAgent {
    config: AgentConfig;
    private trades;
    execute(): Promise<void>;
    fetchPrices(): Promise<Record<string, number>>;
}
export declare const scalpingBot: ScalpingBot;
export {};
//# sourceMappingURL=scalping-bot.d.ts.map