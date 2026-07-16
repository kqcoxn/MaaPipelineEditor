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

const IconToumingdu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M928.597333 421.845333a329.6 329.6 0 1 1-659.2 0 329.6 329.6 0 0 1 659.2 0z"
        fill={getIconColor(color, 0, '#68C584')}
      />
      <path
        d="M615.594667 665.813333a261.930667 261.930667 0 1 1-523.861334 0 261.930667 261.930667 0 0 1 523.861334 0z"
        fill={getIconColor(color, 1, '#CDEFD8')}
      />
      <path
        d="M269.44 417.706667a261.930667 261.930667 0 0 1 331.861333 333.653333l-2.304 0.085333A329.6 329.6 0 0 1 269.44 417.706667z"
        fill={getIconColor(color, 2, '#85DEA0')}
      />
    </svg>
  );
};

IconToumingdu.defaultProps = {
  size: 18,
};

export default IconToumingdu;
