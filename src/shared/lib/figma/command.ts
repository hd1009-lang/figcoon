export const COMMAND = {
  'get_variables': 'get_variables',
  'get_json_structure': 'get_json_structure',
  'get_css_layout': 'get_css_layout',
  'get_css_structure': 'get_css_structure',
  'receive_result': 'receive_result'
};

export type Command = typeof COMMAND[keyof typeof COMMAND];