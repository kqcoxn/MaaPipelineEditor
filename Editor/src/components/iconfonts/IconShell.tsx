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

const IconShell: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M895.488 128H128a61.504 61.504 0 0 0-64 58.624v586.56a61.504 61.504 0 0 0 64 58.688h768a61.504 61.504 0 0 0 64-58.688V186.368A61.504 61.504 0 0 0 895.488 128zM192 538.304l128-117.312-128-117.312 64-58.624 192 176-192 175.872z m512 58.688H448v-58.688h256v58.624z"
        fill={getIconColor(color, 0, '#AA759F')}
      />
    </svg>
  );
};

IconShell.defaultProps = {
  size: 18,
};

export default IconShell;
