/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					}
				}
				for (sd = xc.length; !xc[--sd];) xc.pop();
			}
			return x;
		}
		function stringify(x, doExponential, isNonzero) {
			var e = x.e, s = x.c.join(""), n = s.length;
			if (doExponential) s = s.charAt(0) + (n > 1 ? "." + s.slice(1) : "") + (e < 0 ? "e" : "e+") + e;
			else if (e < 0) {
				for (; ++e;) s = "0" + s;
				s = "0." + s;
			} else if (e > 0) {
				if (++e > n) for (e -= n; e--;) s += "0";
				else if (e < n) s = s.slice(0, e) + "." + s.slice(e);
			} else if (n > 1) s = s.charAt(0) + "." + s.slice(1);
			return x.s < 0 && isNonzero ? "-" + s : s;
		}
		P.abs = function() {
			var x = new this.constructor(this);
			x.s = 1;
			return x;
		};
		P.cmp = function(y) {
			var isneg, x = this, xc = x.c, yc = (y = new x.constructor(y)).c, i = x.s, j = y.s, k = x.e, l = y.e;
			if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;
			if (i != j) return i;
			isneg = i < 0;
			if (k != l) return k > l ^ isneg ? 1 : -1;
			j = (k = xc.length) < (l = yc.length) ? k : l;
			for (i = -1; ++i < j;) if (xc[i] != yc[i]) return xc[i] > yc[i] ^ isneg ? 1 : -1;
			return k == l ? 0 : k > l ^ isneg ? 1 : -1;
		};
		P.div = function(y) {
			var x = this, Big = x.constructor, a = x.c, b = (y = new Big(y)).c, k = x.s == y.s ? 1 : -1, dp = Big.DP;
			if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
			if (!b[0]) throw Error(DIV_BY_ZERO);
			if (!a[0]) {
				y.s = k;
				y.c = [y.e = 0];
				return y;
			}
			var bl, bt, n, cmp, ri, bz = b.slice(), ai = bl = b.length, al = a.length, r = a.slice(0, bl), rl = r.length, q = y, qc = q.c = [], qi = 0, p = dp + (q.e = x.e - y.e) + 1;
			q.s = k;
			k = p < 0 ? 0 : p;
			bz.unshift(0);
			for (; rl++ < bl;) r.push(0);
			do {
				for (n = 0; n < 10; n++) {
					if (bl != (rl = r.length)) cmp = bl > rl ? 1 : -1;
					else for (ri = -1, cmp = 0; ++ri < bl;) if (b[ri] != r[ri]) {
						cmp = b[ri] > r[ri] ? 1 : -1;
						break;
					}
					if (cmp < 0) {
						for (bt = rl == bl ? b : bz; rl;) {
							if (r[--rl] < bt[rl]) {
								ri = rl;
								for (; ri && !r[--ri];) r[ri] = 9;
								--r[ri];
								r[rl] += 10;
							}
							r[rl] -= bt[rl];
						}
						for (; !r[0];) r.shift();
					} else break;
				}
				qc[qi++] = cmp ? n : ++n;
				if (r[0] && cmp) r[rl] = a[ai] || 0;
				else r = [a[ai]];
			} while ((ai++ < al || r[0] !== UNDEFINED) && k--);
			if (!qc[0] && qi != 1) {
				qc.shift();
				q.e--;
				p--;
			}
			if (qi > p) round(q, p, Big.RM, r[0] !== UNDEFINED);
			return q;
		};
		P.eq = function(y) {
			return this.cmp(y) === 0;
		};
		P.gt = function(y) {
			return this.cmp(y) > 0;
		};
		P.gte = function(y) {
			return this.cmp(y) > -1;
		};
		P.lt = function(y) {
			return this.cmp(y) < 0;
		};
		P.lte = function(y) {
			return this.cmp(y) < 1;
		};
		P.minus = P.sub = function(y) {
			var i, j, t, xlty, x = this, Big = x.constructor, a = x.s, b = (y = new Big(y)).s;
			if (a != b) {
				y.s = -b;
				return x.plus(y);
			}
			var xc = x.c.slice(), xe = x.e, yc = y.c, ye = y.e;
			if (!xc[0] || !yc[0]) {
				if (yc[0]) y.s = -b;
				else if (xc[0]) y = new Big(x);
				else y.s = 1;
				return y;
			}
			if (a = xe - ye) {
				if (xlty = a < 0) {
					a = -a;
					t = xc;
				} else {
					ye = xe;
					t = yc;
				}
				t.reverse();
				for (b = a; b--;) t.push(0);
				t.reverse();
			} else {
				j = ((xlty = xc.length < yc.length) ? xc : yc).length;
				for (a = b = 0; b < j; b++) if (xc[b] != yc[b]) {
					xlty = xc[b] < yc[b];
					break;
				}
			}
			if (xlty) {
				t = xc;
				xc = yc;
				yc = t;
				y.s = -y.s;
			}
			if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--;) xc[i++] = 0;
			for (b = i; j > a;) {
				if (xc[--j] < yc[j]) {
					for (i = j; i && !xc[--i];) xc[i] = 9;
					--xc[i];
					xc[j] += 10;
				}
				xc[j] -= yc[j];
			}
			for (; xc[--b] === 0;) xc.pop();
			for (; xc[0] === 0;) {
				xc.shift();
				--ye;
			}
			if (!xc[0]) {
				y.s = 1;
				xc = [ye = 0];
			}
			y.c = xc;
			y.e = ye;
			return y;
		};
		P.mod = function(y) {
			var ygtx, x = this, Big = x.constructor, a = x.s, b = (y = new Big(y)).s;
			if (!y.c[0]) throw Error(DIV_BY_ZERO);
			x.s = y.s = 1;
			ygtx = y.cmp(x) == 1;
			x.s = a;
			y.s = b;
			if (ygtx) return new Big(x);
			a = Big.DP;
			b = Big.RM;
			Big.DP = Big.RM = 0;
			x = x.div(y);
			Big.DP = a;
			Big.RM = b;
			return this.minus(x.times(y));
		};
		P.neg = function() {
			var x = new this.constructor(this);
			x.s = -x.s;
			return x;
		};
		P.plus = P.add = function(y) {
			var e, k, t, x = this, Big = x.constructor;
			y = new Big(y);
			if (x.s != y.s) {
				y.s = -y.s;
				return x.minus(y);
			}
			var xe = x.e, xc = x.c, ye = y.e, yc = y.c;
			if (!xc[0] || !yc[0]) {
				if (!yc[0]) if (xc[0]) y = new Big(x);
				else y.s = x.s;
				return y;
			}
			xc = xc.slice();
			if (e = xe - ye) {
				if (e > 0) {
					ye = xe;
					t = yc;
				} else {
					e = -e;
					t = xc;
				}
				t.reverse();
				for (; e--;) t.push(0);
				t.reverse();
			}
			if (xc.length - yc.length < 0) {
				t = yc;
				yc = xc;
				xc = t;
			}
			e = yc.length;
			for (k = 0; e; xc[e] %= 10) k = (xc[--e] = xc[e] + yc[e] + k) / 10 | 0;
			if (k) {
				xc.unshift(k);
				++ye;
			}
			for (e = xc.length; xc[--e] === 0;) xc.pop();
			y.c = xc;
			y.e = ye;
			return y;
		};
		P.pow = function(n) {
			var x = this, one = new x.constructor("1"), y = one, isneg = n < 0;
			if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + "exponent");
			if (isneg) n = -n;
			for (;;) {
				if (n & 1) y = y.times(x);
				n >>= 1;
				if (!n) break;
				x = x.times(x);
			}
			return isneg ? one.div(y) : y;
		};
		P.prec = function(sd, rm) {
			if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + "precision");
			return round(new this.constructor(this), sd, rm);
		};
		P.round = function(dp, rm) {
			if (dp === UNDEFINED) dp = 0;
			else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) throw Error(INVALID_DP);
			return round(new this.constructor(this), dp + this.e + 1, rm);
		};
		P.sqrt = function() {
			var r, c, t, x = this, Big = x.constructor, s = x.s, e = x.e, half = new Big("0.5");
			if (!x.c[0]) return new Big(x);
			if (s < 0) throw Error(NAME + "No square root");
			s = Math.sqrt(+stringify(x, true, true));
			if (s === 0 || s === Infinity) {
				c = x.c.join("");
				if (!(c.length + e & 1)) c += "0";
				s = Math.sqrt(c);
				e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
				r = new Big((s == Infinity ? "5e" : (s = s.toExponential()).slice(0, s.indexOf("e") + 1)) + e);
			} else r = new Big(s + "");
			e = r.e + (Big.DP += 4);
			do {
				t = r;
				r = half.times(t.plus(x.div(t)));
			} while (t.c.slice(0, e).join("") !== r.c.slice(0, e).join(""));
			return round(r, (Big.DP -= 4) + r.e + 1, Big.RM);
		};
		P.times = P.mul = function(y) {
			var c, x = this, Big = x.constructor, xc = x.c, yc = (y = new Big(y)).c, a = xc.length, b = yc.length, i = x.e, j = y.e;
			y.s = x.s == y.s ? 1 : -1;
			if (!xc[0] || !yc[0]) {
				y.c = [y.e = 0];
				return y;
			}
			y.e = i + j;
			if (a < b) {
				c = xc;
				xc = yc;
				yc = c;
				j = a;
				a = b;
				b = j;
			}
			for (c = new Array(j = a + b); j--;) c[j] = 0;
			for (i = b; i--;) {
				b = 0;
				for (j = a + i; j > i;) {
					b = c[j] + yc[i] * xc[j - i - 1] + b;
					c[j--] = b % 10;
					b = b / 10 | 0;
				}
				c[j] = b;
			}
			if (b) ++y.e;
			else c.shift();
			for (i = c.length; !c[--i];) c.pop();
			y.c = c;
			return y;
		};
		P.toExponential = function(dp, rm) {
			var x = this, n = x.c[0];
			if (dp !== UNDEFINED) {
				if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
				x = round(new x.constructor(x), ++dp, rm);
				for (; x.c.length < dp;) x.c.push(0);
			}
			return stringify(x, true, !!n);
		};
		P.toFixed = function(dp, rm) {
			var x = this, n = x.c[0];
			if (dp !== UNDEFINED) {
				if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
				x = round(new x.constructor(x), dp + x.e + 1, rm);
				for (dp = dp + x.e + 1; x.c.length < dp;) x.c.push(0);
			}
			return stringify(x, false, !!n);
		};
		P.toJSON = P.toString = function() {
			var x = this, Big = x.constructor;
			return stringify(x, x.e <= Big.NE || x.e >= Big.PE, !!x.c[0]);
		};
		if (typeof Symbol !== "undefined") P[Symbol.for("nodejs.util.inspect.custom")] = P.toJSON;
		P.toNumber = function() {
			var n = +stringify(this, true, true);
			if (this.constructor.strict === true && !this.eq(n.toString())) throw Error(NAME + "Imprecise conversion");
			return n;
		};
		P.toPrecision = function(sd, rm) {
			var x = this, Big = x.constructor, n = x.c[0];
			if (sd !== UNDEFINED) {
				if (sd !== ~~sd || sd < 1 || sd > MAX_DP) throw Error(INVALID + "precision");
				x = round(new Big(x), sd, rm);
				for (; x.c.length < sd;) x.c.push(0);
			}
			return stringify(x, sd <= x.e || x.e <= Big.NE || x.e >= Big.PE, !!n);
		};
		P.valueOf = function() {
			var x = this, Big = x.constructor;
			if (Big.strict === true) throw Error(NAME + "valueOf disallowed");
			return stringify(x, x.e <= Big.NE || x.e >= Big.PE, true);
		};
		var Big = _Big_();
		//#endregion
		//#region lib/types/client/formatBalance.js
		/** Platform Web currency formatting for account balances; source amounts retain decimal precision. */
		/**
		* Format a balance using Platform Web's two-decimal and sub-cent display rules.
		* @param amount - validated decimal balance string.
		* @param symbol - currency symbol.
		* @returns signed currency text with grouped digits.
		*/
		function formatBalance(amount, symbol) {
			const value = new Big(amount);
			if (value.eq(0)) return `${symbol}0.00`;
			if (value.lt(0)) return `-${symbol}${value.gt(-.01) ? "0.01" : addCommas(value.abs().toFixed(2))}`;
			if (value.lt("0.01")) return `<${symbol}0.01`;
			return `${symbol}${addCommas(value.round(2, Big.roundDown).toFixed(2))}`;
		}
		function addCommas(value) {
			const [integer, fraction] = value.split(".");
			return `${Number(integer).toLocaleString()}.${fraction}`;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/AccountSection.module.css.mjs
		const css$2 = ".LcmJYa_section{color:var(--dsw-alias-label-primary);flex-direction:column;gap:16px;padding:8px 0;font-size:13px;line-height:22px;display:flex}.LcmJYa_card,.LcmJYa_balanceCard{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);padding:12px 16px}.LcmJYa_card,.LcmJYa_row{justify-content:space-between;align-items:center;gap:16px;display:flex}.LcmJYa_identity{align-items:center;gap:10px;min-width:0;min-height:44px;display:flex}.LcmJYa_avatar{corner-shape:round;width:32px;height:32px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-skeleton);border-radius:50%;flex:none;justify-content:center;align-items:center;display:flex}.LcmJYa_identityCopy{flex-direction:column;min-width:0;display:flex}.LcmJYa_name{font-size:14px;font-weight:500}.LcmJYa_status,.LcmJYa_secondary,.LcmJYa_unavailable{color:var(--dsw-alias-label-tertiary)}.LcmJYa_balanceCard{flex-direction:column;gap:8px;display:flex}.LcmJYa_row{box-sizing:border-box;min-height:40px;padding:6px 0}.LcmJYa_divider{border-top:.5px solid var(--dsw-alias-border-l2)}.LcmJYa_links,.LcmJYa_actions{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:10px;display:flex}.LcmJYa_linkButton{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);white-space:nowrap;min-width:58px;height:36px;color:var(--dsw-alias-label-primary);background:0 0;flex:none;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;text-decoration:none;display:inline-flex}.LcmJYa_linkButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.LcmJYa_linkButton:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.LcmJYa_unavailableLink{color:var(--dsw-alias-label-tertiary);text-underline-offset:3px;text-decoration:underline}.LcmJYa_unavailableLink:hover{color:var(--dsw-alias-label-primary)}.LcmJYa_unavailableLink:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;border-radius:4px}.LcmJYa_primary{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);border-color:#0000;font-weight:500}.LcmJYa_primary:hover{background:var(--dsw-alias-button-primary-hover)}.LcmJYa_signedOut{box-sizing:border-box;min-height:calc(100% + 16px);color:var(--dsw-alias-label-primary);flex-direction:column;justify-content:center;align-items:center;margin-bottom:-16px;padding-bottom:8px;display:flex}.LcmJYa_signedOutContent{flex-direction:column;justify-content:center;align-items:center;gap:20px;width:100%;min-height:60px;padding:12px 0;display:flex}.LcmJYa_signedOutCopy{text-align:center;flex-direction:column;gap:4px;width:100%;display:flex}.LcmJYa_signedOutTitle{font-size:14px;line-height:22px}.LcmJYa_signedOutDescription{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.LcmJYa_signInButton{min-width:72px;font-weight:500}.LcmJYa_amount{flex-wrap:wrap;justify-content:flex-end;font-size:18px;font-weight:510;line-height:28px;display:flex}.LcmJYa_amount>span+span:before{content:\" + \";white-space:pre}.LcmJYa_accountInfo{color:var(--dsw-alias-label-primary);flex:none;align-items:center;gap:2px;font-size:13px;line-height:22px;text-decoration:none;display:inline-flex}.LcmJYa_bonusValue{justify-content:flex-end;align-items:center;gap:8px;display:flex}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-settings-account/AccountSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var AccountSection_module_css_default = {
			"accountInfo": "LcmJYa_accountInfo",
			"actions": "LcmJYa_actions",
			"amount": "LcmJYa_amount",
			"avatar": "LcmJYa_avatar",
			"balanceCard": "LcmJYa_balanceCard",
			"bonusValue": "LcmJYa_bonusValue",
			"card": "LcmJYa_card",
			"divider": "LcmJYa_divider",
			"identity": "LcmJYa_identity",
			"identityCopy": "LcmJYa_identityCopy",
			"linkButton": "LcmJYa_linkButton",
			"links": "LcmJYa_links",
			"name": "LcmJYa_name",
			"primary": "LcmJYa_primary",
			"row": "LcmJYa_row",
			"secondary": "LcmJYa_secondary",
			"section": "LcmJYa_section",
			"signInButton": "LcmJYa_signInButton",
			"signedOut": "LcmJYa_signedOut",
			"signedOutContent": "LcmJYa_signedOutContent",
			"signedOutCopy": "LcmJYa_signedOutCopy",
			"signedOutDescription": "LcmJYa_signedOutDescription",
			"signedOutTitle": "LcmJYa_signedOutTitle",
			"status": "LcmJYa_status",
			"unavailable": "LcmJYa_unavailable",
			"unavailableLink": "LcmJYa_unavailableLink"
		};
		//#endregion
		//#region lib/types/client/AccountSection.js
		/** Account settings renders safe Host state and explicit login actions. */
		/** @param props - localized actions, account subscription, and the shared Platform page channel. @returns account settings UI. */
		function AccountSection({ t, useAccount, useTheme, start, cancel, openPlatformPage, avatarFailed }) {
			const { view: state, details, avatar, failed: streamFailed } = useAccount((value) => value);
			const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
			const releasePage = (0, react.useRef)(void 0);
			const [failed, setFailed] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
export {};
