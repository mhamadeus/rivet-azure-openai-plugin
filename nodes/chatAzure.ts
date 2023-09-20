import { nanoid } from 'nanoid';
import {
  ChartNode,
  EditorDefinition,
  Inputs,
  InternalProcessContext,
  NodeBodySpec,
  NodeId,
  NodeImpl,
  NodeInputDefinition,
  NodeOutputDefinition,
  NodeUIData,
  Outputs,
  PluginNodeImpl,
  PortId,
  coerceType,
  getInputOrData,
  nodeDefinition,
  pluginNodeDefinition,
} from '../../../../index.js';
import { Configuration, OpenAIApi } from 'azure-openai';
import { dedent } from 'ts-dedent';

export type ChatAzureNode = ChartNode<'chatAzure', ChatAzureNodeData>;

export type ChatAzureNodeData = {
  deploymentName?: string;
  useDeploymentNameInput?: boolean;

  temperature?: number;
  useTemperatureInput?: boolean;

  max_tokens: number;
  useMax_tokensInput?: boolean;

  presence_penalty?: number;
  usePresence_penaltyInput?: boolean;

  frequency_penalty?: number;
  frequency_penaltyInput?: boolean;

  top_p?: number;
  useTop_pInput?: boolean;

  stop?: number;
  useStopInput?: boolean;
};

export const ChatAzureNodeImpl: PluginNodeImpl<ChatAzureNode> = {
  create(): ChatAzureNode {
    return {
      id: nanoid() as NodeId,
      type: 'ChatAzure',
      data: {
        model: '',
        temperature: 0.7,
        max_tokens: 1024,
        presence_penalty: 0,
        top_p: 0.95
      },
      title: 'Chat (OpenAI on Azure)',
      visualData: {
        x: 0,
        y: 0,
        width: 300,
      },
    };
  },

  getUIData(): NodeUIData {
    return {
      group: ['AI', 'OpenAI on Azure'],
      contextMenuTitle: 'Chat (OpenAI on Azure)',
      infoBoxTitle: 'Chat (OpenAI on Azure) Node',
      infoBoxBody: 'Chat, using OpenAI on Azure',
    };
  },

  getInputDefinitions(data): NodeInputDefinition[] {
    const inputs: NodeInputDefinition[] = [];

    inputs.push({
      id: 'prompt' as PortId,
      dataType: 'string',
      title: 'Prompt',
      required: true,
    });

    inputs.push({
      id: 'systemMessage' as PortId,
      dataType: 'string',
      title: 'System Message',
      required: true,
    });

    if (data.useTemperatureInput) {
      inputs.push({
        id: 'temperature' as PortId,
        dataType: 'number',
        title: 'Temperature',
      });
    }

    if (data.useMax_tokensInput) {
      inputs.push({
        id: 'max_tokens' as PortId,
        dataType: 'number',
        title: 'Max New Tokens',
      });
    }

    if (data.frequency_penaltyInput) {
      inputs.push({
        id: 'frequency_penalty' as PortId,
        dataType: 'number',
        title: 'Frequency Penalty',
      });
    }

    if (data.useTop_pInput) {
      inputs.push({
        id: 'top_p' as PortId,
        dataType: 'number',
        title: 'Top P',
      });
    }
    if (data.useStopInput) {
      inputs.push({
        id: 'stop' as PortId,
        dataType: 'number',
        title: 'Stop',
      });
    }

    return inputs;
  },

  getOutputDefinitions(): NodeOutputDefinition[] {
    return [
      {
        id: 'output' as PortId,
        dataType: 'string',
        title: 'Output',
      },
    ];
  },

  getEditors(): EditorDefinition<ChatAzureNode>[] {
    return [
      {
        type: 'number',
        label: 'Temperature (0-100)',
        dataKey: 'temperature',
        useInputToggleDataKey: 'useTemperatureInput',
        min: 0,
        step: 50,
        allowEmpty: true,
      },
      {
        type: 'number',
        label: 'Max New Tokens',
        dataKey: 'maxNewTokens',
        useInputToggleDataKey: 'useMaxNewTokensInput',
        min: 0,
        step: 1,
      },
      {
        type: 'toggle',
        label: 'Do Sample',
        dataKey: 'doSample',
        useInputToggleDataKey: 'useDoSampleInput',
      },
      {
        type: 'number',
        label: 'Max Time (s)',
        dataKey: 'maxTime',
        useInputToggleDataKey: 'useMaxTimeInput',
        allowEmpty: true,
      },
      {
        type: 'number',
        label: 'Repetition Penalty (0-100)',
        dataKey: 'repetitionPenalty',
        useInputToggleDataKey: 'useRepetitionPenaltyInput',
        allowEmpty: true,
      },
      {
        type: 'number',
        label: 'Top P (0-100)',
        dataKey: 'topP',
        useInputToggleDataKey: 'useTopPInput',
        allowEmpty: true,
      },
      {
        type: 'number',
        label: 'Top K (0-100)',
        dataKey: 'topK',
        useInputToggleDataKey: 'useTopKInput',
        allowEmpty: true,
      },
    ];
  },

  getBody(data): string | NodeBodySpec | NodeBodySpec[] | undefined {
    return dedent`
      ${
        data.endpoint || data.useEndpointInput
          ? `Endpoint: ${data.useEndpointInput ? '(Using Input)' : 'Yes'}`
          : `Model: ${data.useModelInput ? '(Using Input)' : data.model}`
      }
      ${
        data.useTemperatureInput
          ? 'Temperature: (Using Input)'
          : data.temperature != null
          ? `Temperature: ${data.temperature}`
          : ''
      }
      Max New Tokens: ${data.useMaxNewTokensInput ? '(Using Input)' : data.maxNewTokens}
    `;
  },

  async process(data, inputData, context): Promise<Outputs> {
    const accessToken = context.getPluginConfig('huggingFaceAccessToken');

    const prompt = coerceType(inputData['prompt' as PortId], 'string');
    const endpoint = getInputOrData(data, inputData, 'endpoint');

    const model = getInputOrData(data, inputData, 'model');
    const temperature = getInputOrData(data, inputData, 'temperature', 'number');
    const maxNewTokens = getInputOrData(data, inputData, 'maxNewTokens', 'number');
    const doSample = getInputOrData(data, inputData, 'doSample', 'boolean');
    const maxTime = getInputOrData(data, inputData, 'maxTime', 'number');
    const repetitionPenalty = getInputOrData(data, inputData, 'repetitionPenalty', 'number');
    const topP = getInputOrData(data, inputData, 'topP', 'number');
    const topK = getInputOrData(data, inputData, 'topK', 'number');

    const hf = endpoint ? new HfInferenceEndpoint(endpoint, accessToken) : new HfInference(accessToken);

    const generationStream = hf.textGenerationStream({
      inputs: prompt,
      model,
      parameters: {
        temperature,
        max_new_tokens: maxNewTokens,
        do_sample: doSample,
        max_time: maxTime,
        repetition_penalty: repetitionPenalty,
        top_p: topP,
        top_k: topK,
      },
    });

    const parts = [];

    for await (const { token } of generationStream) {
      if (!token.special) {
        parts.push(token.text);
      }

      context.onPartialOutputs?.({
        ['output' as PortId]: {
          type: 'string',
          value: parts.join(''),
        },
      });
    }

    return {
      ['output' as PortId]: {
        type: 'string',
        value: parts.join(''),
      },
    };
  },
};

export const ChatAzureNode = pluginNodeDefinition(ChatAzureNodeImpl, 'Chat (OpenAI on Azure)');
