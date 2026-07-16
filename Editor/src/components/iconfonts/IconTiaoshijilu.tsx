/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconTiaoshijilu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M0 0m73.142857 0l731.428572 0q73.142857 0 73.142857 73.142857l0 804.571429q0 73.142857-73.142857 73.142857l-731.428572 0q-73.142857 0-73.142857-73.142857l0-804.571429q0-73.142857 73.142857-73.142857Z"
        fill={getIconColor(color, 0, '#3377FF')}
      />
      <path
        d="M146.285714 146.285714h585.142857v73.142857h-585.142857z"
        fill={getIconColor(color, 1, '#FFFFFF')}
      />
      <path
        d="M146.285714 292.571429h365.714286v73.142857h-365.714286z"
        fill={getIconColor(color, 2, '#FFFFFF')}
      />
      <path
        d="M146.285714 438.857143h219.428572v73.142857h-219.428572z"
        fill={getIconColor(color, 3, '#FFFFFF')}
      />
      <path
        d="M694.857143 694.857143m-329.142857 0a329.142857 329.142857 0 1 0 658.285714 0 329.142857 329.142857 0 1 0-658.285714 0Z"
        fill={getIconColor(color, 4, '#C9DCF4')}
      />
      <path
        d="M751.616 794.843429a154.477714 154.477714 0 0 1-208.749714-208.676572l65.828571 65.828572a45.494857 45.494857 0 0 0 64.365714-64.292572l-65.828571-65.828571a154.404571 154.404571 0 0 1 208.457143 208.749714l150.528 150.601143a331.190857 331.190857 0 0 1-61.147429 66.925714z"
        fill={getIconColor(color, 5, '#3377FF')}
      />
    </svg>
  );
};

IconTiaoshijilu.defaultProps = {
  size: 18,
};

export default IconTiaoshijilu;
