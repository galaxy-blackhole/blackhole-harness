/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ten san pham cua tung giao thuc pi-ai
 */


/**
* Product names for the wire protocols a pi-ai route may speak. The pickers
* show these instead of the schema identifiers (`openai-completions`), which
* are what `settings.yaml` carries and what the option values stay.
*/
/** The protocols this page names, keyed by their schema identifier. */
const PROTOCOL_LABEL_KEYS: Record<string, string> = {
	"openai-completions": "protocolOpenAiCompletions",
	"openai-responses": "protocolOpenAiResponses",
	"anthropic-messages": "protocolAnthropicMessages"
};
/**
* The picker text for one protocol identifier.
* @param t - section copy.
* @param protocol - the schema identifier of the protocol.
* @returns the product name this page knows the protocol by; a protocol the
* adapter adds before this page names it shows its identifier, the spelling
* `settings.yaml` needs anyway.
*/
export function protocolLabel(t: any, protocol: any) {
	const key = PROTOCOL_LABEL_KEYS[protocol];
	return key === void 0 ? protocol : t(key);
}
