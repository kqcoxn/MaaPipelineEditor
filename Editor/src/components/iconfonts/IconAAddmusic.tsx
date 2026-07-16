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

const IconAAddmusic: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1028 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M514.686214 3.524465c323.836428-4.243647 528.250642 198.713153 509.894846 508.475535-10.244763 309.300391-214.66374 515.181544-509.894846 511.309395C219.464633 1027.181544 15.045656 821.300391 4.79613 512-13.564428 202.242381 190.854549-0.714419 514.686214 3.524465z"
        fill={getIconColor(color, 0, '#83BE42')}
      />
      <path
        d="M726.196986 435.533395H609.637209V319.502288c0-39.454958-31.986902-71.44186-71.44186-71.44186-39.454958 0-71.44186 31.986902-71.441861 71.44186v116.03587H350.193712c-39.454958 0-71.44186 31.986902-71.441861 71.441861 0 39.454958 31.986902 71.44186 71.441861 71.44186H466.753488v117.078921c0 39.454958 31.986902 71.44186 71.441861 71.44186 39.454958 0 71.44186-31.986902 71.44186-71.44186v-117.078921h116.559777c39.454958 0 71.44186-31.986902 71.441861-71.44186 0-39.454958-31.986902-71.446623-71.441861-71.446624z"
        fill={getIconColor(color, 1, '#FFFFFF')}
      />
    </svg>
  );
};

IconAAddmusic.defaultProps = {
  size: 18,
};

export default IconAAddmusic;
