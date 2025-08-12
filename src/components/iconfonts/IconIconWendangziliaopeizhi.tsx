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

const IconIconWendangziliaopeizhi: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M989.696 725.3248c0 62.8224-35.4304 119.5008-98.2784 119.5008H151.8848c-62.8224 0-134.9632-56.6528-134.9632-119.5008V165.3248C16.9216 102.5024 202.8288 0 265.6768 0h586.6752c88.0128 0 137.3952 51.5328 137.3952 138.624v586.7008z"
        fill={getIconColor(color, 0, '#678036')}
      />
      <path
        d="M938.496 839.0912c0 62.8224-41.1392 133.7088-103.9616 133.7088H208.768c-62.8224 0-140.6464-70.8864-140.6464-133.7088V156.4416c0-117.1712 26.2912-105.216 169.1136-105.216H834.56c62.8224 0 103.9616 42.368 103.9616 105.216v682.6496z"
        fill={getIconColor(color, 1, '#CCD6DD')}
      />
      <path
        d="M861.696 861.8752A85.3248 85.3248 0 0 1 776.3712 947.2H102.2464a85.3248 85.3248 0 0 1-85.3248-85.3248V187.7504a85.3248 85.3248 0 0 1 85.3248-85.3248h674.1248a85.3248 85.3248 0 0 1 85.3248 85.3248v674.1248z"
        fill={getIconColor(color, 2, '#E1E8ED')}
      />
      <path
        d="M861.696 910.2336A113.7664 113.7664 0 0 1 747.9296 1024H156.288a113.7664 113.7664 0 0 1-113.7664-113.7664V292.992a113.7664 113.7664 0 0 1 113.7664-113.7664h591.6416a113.7664 113.7664 0 0 1 113.7664 113.7664v617.2416z"
        fill={getIconColor(color, 3, '#82A637')}
      />
      <path
        d="M810.496 895.9744c0 62.8224-26.9056 128.0256-89.7536 128.0256H180.3264c-62.8224 0-137.8048-65.2032-137.8048-128.0256V327.0912C42.5216 264.2688 117.504 230.4 180.3264 230.4h549.9648c62.8224 0 80.2048 24.2944 80.2048 87.1424v578.432z"
        fill={getIconColor(color, 4, '#82A637')}
      />
      <path
        d="M180.3264 179.2256c-48 0-49.2544-61.7984-28.4416-85.3248 23.6544-26.752 60.4416-42.6752 126.2336-42.6752h20.4032v-51.2H245.1968C132.3008 0.0256 16.896 56.8832 16.896 138.6496v757.3248C16.896 958.7968 89.0368 1024 151.8592 1024H196.096V179.2h-15.7696z"
        fill={getIconColor(color, 5, '#678036')}
      />
      <path
        d="M686.2336 460.3392c0 28.16-23.04 51.2-51.2 51.2h-214.0416c-28.16 0-51.2-23.04-51.2-51.2V403.2c0-28.16 23.04-51.2 51.2-51.2h214.0416c28.16 0 51.2 23.04 51.2 51.2v57.1392z"
        fill={getIconColor(color, 6, '#A4BE6B')}
      />
    </svg>
  );
};

IconIconWendangziliaopeizhi.defaultProps = {
  size: 18,
};

export default IconIconWendangziliaopeizhi;
