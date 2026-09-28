import { BaseAgent, AgentConfig } from '../base-agent';
declare class SupportResistanceBot extends BaseAgent {
    config: AgentConfig;
    private levels;
    execute(): Promise<void>;
    calculateLevels(symbol: string, price: number): {
        support: number;
        resistance: number;
    };
    fetchPrices(): Promise<Record<string, number>>;
}
export declare const supportResistanceBot: SupportResistanceBot;
export {};
//# sourceMappingURL=support-resistance-bot.d.ts.map