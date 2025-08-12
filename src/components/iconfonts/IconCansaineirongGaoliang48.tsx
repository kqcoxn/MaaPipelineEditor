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

const IconCansaineirongGaoliang48: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M725.333333 85.333333a170.666667 170.666667 0 0 1 170.666667 170.666667v659.072a42.666667 42.666667 0 0 1-60.330667 38.826667l-314.837333-143.104a21.333333 21.333333 0 0 0-17.664 0L188.330667 953.92A42.666667 42.666667 0 0 1 128 915.072V256a170.666667 170.666667 0 0 1 170.666667-170.666667h426.666666z m-32 490.666667h-362.666666a32 32 0 0 0 0 64h362.666666a32 32 0 0 0 0-64zM512 256h-106.666667a106.666667 106.666667 0 0 0-106.666666 106.666667v21.333333a106.666667 106.666667 0 0 0 106.666666 106.666667h106.666667a106.666667 106.666667 0 0 0 106.666667-106.666667v-21.333333a106.666667 106.666667 0 0 0-106.666667-106.666667z m0 64a42.666667 42.666667 0 0 1 42.666667 42.666667v21.333333a42.666667 42.666667 0 0 1-42.666667 42.666667h-106.666667a42.666667 42.666667 0 0 1-42.666666-42.666667v-21.333333a42.666667 42.666667 0 0 1 42.666666-42.666667z"
        fill={getIconColor(color, 0, '#1AB370')}
      />
    </svg>
  );
};

IconCansaineirongGaoliang48.defaultProps = {
  size: 18,
};

export default IconCansaineirongGaoliang48;
