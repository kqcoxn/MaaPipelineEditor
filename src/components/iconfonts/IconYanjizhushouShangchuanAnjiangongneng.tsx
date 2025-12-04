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

const IconYanjizhushouShangchuanAnjiangongneng: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M130.194286 160l763.428571 0 0 710.765714-763.428571 0 0-710.765714Z"
        fill={getIconColor(color, 0, '#FFFFFF')}
      />
      <path
        d="M893.805714 654.08V822.857143c0 26.88-51.2 48.457143-114.285714 48.457143H244.48c-63.085714 0-114.285714-21.577143-114.285714-48.457143v-168.228572"
        fill={getIconColor(color, 1, '#EAEAEA')}
      />
      <path
        d="M779.52 898.194286H244.48a141.714286 141.714286 0 0 1-141.714286-141.531429V274.285714a141.714286 141.714286 0 0 1 141.714286-141.531428h535.04A141.714286 141.714286 0 0 1 921.234286 274.285714v482.377143a141.714286 141.714286 0 0 1-141.714286 141.531429zM244.48 187.428571A86.857143 86.857143 0 0 0 157.622857 274.285714v482.377143a86.857143 86.857143 0 0 0 86.857143 86.674286h535.04a86.857143 86.857143 0 0 0 86.857143-86.674286V274.285714a86.857143 86.857143 0 0 0-86.857143-86.674285z"
        fill={getIconColor(color, 2, '#808080')}
      />
      <path
        d="M359.862857 390.034286h-76.982857a27.428571 27.428571 0 1 1 0-54.857143h76.982857a27.428571 27.428571 0 0 1 0 54.857143zM545.097143 390.034286h-77.165714a27.428571 27.428571 0 0 1 0-54.857143h77.165714a27.428571 27.428571 0 1 1 0 54.857143zM730.148571 390.034286h-76.982857a27.428571 27.428571 0 0 1 0-54.857143h76.982857a27.428571 27.428571 0 0 1 0 54.857143zM359.862857 536.32h-76.982857a27.428571 27.428571 0 1 1 0-54.857143h76.982857a27.428571 27.428571 0 0 1 0 54.857143zM545.097143 536.32h-77.165714a27.428571 27.428571 0 0 1 0-54.857143h77.165714a27.428571 27.428571 0 1 1 0 54.857143zM730.148571 536.32h-76.982857a27.428571 27.428571 0 0 1 0-54.857143h76.982857a27.428571 27.428571 0 0 1 0 54.857143zM730.148571 682.605714H282.88a27.428571 27.428571 0 1 1 0-54.857143h447.268571a27.428571 27.428571 0 0 1 0 54.857143z"
        fill={getIconColor(color, 3, '#808080')}
      />
    </svg>
  );
};

IconYanjizhushouShangchuanAnjiangongneng.defaultProps = {
  size: 18,
};

export default IconYanjizhushouShangchuanAnjiangongneng;
