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

const IconHuozhe: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1496 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M931.868465 32.52798781a476.96130094 476.96130094 0 0 0-176.48823563 42.82978125L733.5222725 86.2129025 711.66431563 75.35776906A479.98892344 479.98892344 0 1 0 511.98892344 991.98892344l23.1871575-0.51691125a477.69974531 477.69974531 0 0 0 176.48823469-42.82978125l21.85795687-10.78128938 21.93180187 10.78128938A479.98892344 479.98892344 0 1 0 955.05562156 32.01107656l-23.18715656 0.51691125z"
        fill={getIconColor(color, 0, '#5584FF')}
      />
      <path
        d="M955.05562156 105.85552625a406.14447375 406.14447375 0 1 1-203.07223687 758.01327656l-18.46111219-10.70744531-18.46111219 10.70744531a406.14447375 406.14447375 0 1 1 0-703.66376156l18.53495625 10.70744531 18.46111313-10.70744531A403.19069531 403.19069531 0 0 1 955.05562156 105.85552625z"
        fill={getIconColor(color, 1, '#A3BDFF')}
      />
    </svg>
  );
};

IconHuozhe.defaultProps = {
  size: 18,
};

export default IconHuozhe;
