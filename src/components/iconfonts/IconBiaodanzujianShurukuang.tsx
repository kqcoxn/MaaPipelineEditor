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

const IconBiaodanzujianShurukuang: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M635.328 736a32 32 0 0 0-32-32H96V352h507.2a32 32 0 1 0 0-64H64a32 32 0 0 0-32 32v416a32 32 0 0 0 32 32h539.328a32 32 0 0 0 32-32zM960 288h-92.928a32 32 0 1 0 0 64H928v352h-60.288a32 32 0 1 0 0 64H960a32 32 0 0 0 32-32V320a32 32 0 0 0-32-32z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M832.672 848H768v-640h64.288a32 32 0 1 0 0-64H639.36a32 32 0 1 0 0 64H704v640h-64.64a32 32 0 1 0 0 64h193.28a32 32 0 1 0 0.032-64z"
        fill={getIconColor(color, 1, '#333333')}
      />
    </svg>
  );
};

IconBiaodanzujianShurukuang.defaultProps = {
  size: 18,
};

export default IconBiaodanzujianShurukuang;
