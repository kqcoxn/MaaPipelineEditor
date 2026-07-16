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

const IconGongjuxiang: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M0 0h1024v1024H0V0z"
        fill={getIconColor(color, 0, '#202425')}
        opacity=".01"
      />
      <path
        d="M256 170.666667A119.466667 119.466667 0 0 1 375.466667 51.2h273.066666A119.466667 119.466667 0 0 1 768 170.666667v170.666666a85.333333 85.333333 0 0 1-85.333333 85.333334H341.333333A85.333333 85.333333 0 0 1 256 341.333333V170.666667z m119.466667-17.066667a17.066667 17.066667 0 0 0-17.066667 17.066667v153.6h307.2V170.666667a17.066667 17.066667 0 0 0-17.066667-17.066667h-273.066666zM68.266667 614.4a34.133333 34.133333 0 0 1 34.133333-34.133333h819.2a34.133333 34.133333 0 0 1 34.133333 34.133333v204.8a136.533333 136.533333 0 0 1-136.533333 136.533333H204.8a136.533333 136.533333 0 0 1-136.533333-136.533333v-204.8z"
        fill={getIconColor(color, 1, '#FF7744')}
      />
      <path
        d="M68.266667 375.466667a136.533333 136.533333 0 0 1 136.533333-136.533334h614.4a136.533333 136.533333 0 0 1 136.533333 136.533334v136.533333a34.133333 34.133333 0 0 1-34.133333 34.133333H102.4a34.133333 34.133333 0 0 1-34.133333-34.133333v-136.533333z"
        fill={getIconColor(color, 2, '#FFAA44')}
      />
      <path
        d="M375.466667 512a34.133333 34.133333 0 0 1 34.133333-34.133333h204.8a34.133333 34.133333 0 0 1 34.133333 34.133333v102.4a34.133333 34.133333 0 0 1-34.133333 34.133333h-204.8a34.133333 34.133333 0 0 1-34.133333-34.133333v-102.4z"
        fill={getIconColor(color, 3, '#FFFFFF')}
      />
    </svg>
  );
};

IconGongjuxiang.defaultProps = {
  size: 18,
};

export default IconGongjuxiang;
