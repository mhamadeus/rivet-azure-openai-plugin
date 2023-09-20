import { RivetPlugin } from '../../../index.js';
import { ChatAzureNode } from './nodes/ChatAzure.js';

export const azurePlugin: RivetPlugin = {
  id: 'azure',
  name: 'OpenAI on Azure',

  configSpec: {
    huggingFaceAccessToken: {
      type: 'secret',
      label: 'Open AI on Azure Token',
      description: 'Your access token for Open AI on Azure.',
      pullEnvironmentVariable: 'AZURE_ACCESS_TOKEN',
      helperText: 'Retrieve your token from Azure Portal',
    },
  },

  contextMenuGroups: [
    {
      id: 'azure',
      label: 'OpenAI on Azure',
    },
  ],

  register(register) {
    register(ChatAzureNode);
  },
};
