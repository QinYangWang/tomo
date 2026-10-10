/** Model providers the settings page offers. Each one reads its key from the encrypted store. */
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import { groqProvider } from "@earendil-works/pi-ai/providers/groq";
import { mistralProvider } from "@earendil-works/pi-ai/providers/mistral";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { xaiProvider } from "@earendil-works/pi-ai/providers/xai";
import type { MutableModels, Provider } from "@earendil-works/pi-ai/models";

export const PROVIDERS: { id: string; label: string; hint: string; make: () => Provider<any> }[] = [
  { id: "anthropic", label: "Anthropic", hint: "console.anthropic.com → API Keys", make: anthropicProvider },
  { id: "openai", label: "OpenAI", hint: "platform.openai.com → API keys", make: openaiProvider },
  { id: "google", label: "Google Gemini", hint: "Google AI Studio → Get API key", make: googleProvider },
  { id: "openrouter", label: "OpenRouter", hint: "openrouter.ai → Keys", make: openrouterProvider },
  { id: "deepseek", label: "DeepSeek", hint: "platform.deepseek.com → API keys", make: deepseekProvider },
  { id: "xai", label: "xAI", hint: "console.x.ai → API keys", make: xaiProvider },
  { id: "groq", label: "Groq", hint: "console.groq.com → API Keys", make: groqProvider },
  { id: "mistral", label: "Mistral", hint: "console.mistral.ai → API Keys", make: mistralProvider },
];

export function installProviders(models: MutableModels) {
  for (const p of PROVIDERS) models.setProvider(p.make());
}
