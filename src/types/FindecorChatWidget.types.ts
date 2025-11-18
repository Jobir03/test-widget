export interface FindecorChatWidgetProps {
  apiBase: string;
  socketUrl: string;
  widgetKey: string;
  userId?: string;
  color: string;
  textColor: string;
  widgetSize: "small" | "medium" | "large";
  position: "TL" | "TR" | "BL" | "BR";
  borderRadius: string;
  companyName: string;
  autoOpen: boolean;
  headerText: string;
  offlineMessage: string;
  inputPlaceholder: string;
}
