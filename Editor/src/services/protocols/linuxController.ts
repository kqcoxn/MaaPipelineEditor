export interface LinuxControllerOptions {
  socket_path: string;
  screencap_method: "Wlr" | "PipeWire";
  input_method: "None" | "Wlr" | "UInput" | "Libei";
  use_win32_vk_code: boolean;
  pw_node_id?: number;
  eis_socket_path?: string;
  uinput_path?: string;
  uinput_screen_width?: number;
  uinput_screen_height?: number;
}

export const defaultLinuxOptions: LinuxControllerOptions = {
  socket_path: "", screencap_method: "Wlr", input_method: "Wlr", use_win32_vk_code: false,
};
