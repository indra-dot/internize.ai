export type MessageType =
  | 'GET_SELECTED_TEXT'
  | 'SELECTED_TEXT_RESPONSE'
  | 'TEXT_SELECTED'
  | 'OPEN_SIDE_PANEL'
  | 'SYNC_ACTIVE_TAB'
  | 'INSERT_TEXT_TO_FIELD'
  | 'INSERT_TEXT_RESPONSE'
  | 'PING'
  | 'PONG';

export interface BaseMessage {
  type: MessageType;
}

/** Query currently highlighted text from active tab */
export interface GetSelectedTextMessage extends BaseMessage {
  type: 'GET_SELECTED_TEXT';
}

/** Response from tab containing selected text */
export interface SelectedTextResponseMessage extends BaseMessage {
  type: 'SELECTED_TEXT_RESPONSE';
  text: string;
  sourceUrl?: string;
  title?: string;
}

/** Event broadcast when user selects text */
export interface TextSelectedMessage extends BaseMessage {
  type: 'TEXT_SELECTED';
  text: string;
  sourceUrl?: string;
  title?: string;
  timestamp: number;
}

/** Request to open extension side panel */
export interface OpenSidePanelMessage extends BaseMessage {
  type: 'OPEN_SIDE_PANEL';
}

/** Force sync of active tab selection */
export interface SyncActiveTabMessage extends BaseMessage {
  type: 'SYNC_ACTIVE_TAB';
}

/** Request to inject text into the focused EMR form field */
export interface InsertTextToFieldMessage extends BaseMessage {
  type: 'INSERT_TEXT_TO_FIELD';
  text: string;
}

/** Response from content script after field injection attempt */
export interface InsertTextResponseMessage extends BaseMessage {
  type: 'INSERT_TEXT_RESPONSE';
  success: boolean;
  method?: 'execCommand' | 'reactSetter' | 'clipboard';
  error?: string;
}

/** Heartbeat ping */
export interface PingMessage extends BaseMessage {
  type: 'PING';
}

/** Heartbeat response */
export interface PongMessage extends BaseMessage {
  type: 'PONG';
  version: string;
  uptime: number;
}

export type ExtensionMessage =
  | GetSelectedTextMessage
  | SelectedTextResponseMessage
  | TextSelectedMessage
  | OpenSidePanelMessage
  | SyncActiveTabMessage
  | InsertTextToFieldMessage
  | InsertTextResponseMessage
  | PingMessage
  | PongMessage;
