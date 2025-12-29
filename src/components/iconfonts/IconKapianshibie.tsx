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

const IconKapianshibie: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M85.333 128A42.667 42.667 0 0 1 128 85.333h149.333v85.334H170.667v106.666H85.333V128z m853.334 0A42.667 42.667 0 0 0 896 85.333H746.667v85.334h106.666v106.666h85.334V128zM85.333 896A42.667 42.667 0 0 0 128 938.667h149.333v-85.334H170.667V746.667H85.333V896z m853.334 0A42.667 42.667 0 0 1 896 938.667H746.667v-85.334h106.666V746.667h85.334V896zM192 298.667A42.667 42.667 0 0 1 234.667 256h554.666A42.667 42.667 0 0 1 832 298.667v426.666A42.667 42.667 0 0 1 789.333 768H234.667A42.667 42.667 0 0 1 192 725.333V298.667z m85.333 42.666v341.334h469.334V341.333H277.333z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M277.333 405.333h469.334v85.334H277.333v-85.334z m0 128h256v85.334h-256v-85.334z"
        fill={getIconColor(color, 1, '#0078FF')}
      />
    </svg>
  );
};

IconKapianshibie.defaultProps = {
  size: 18,
};

export default IconKapianshibie;
