
interface Part {
	value: number;
	tag: string;
}

export function semver_cmp(s_version_a: string, s_version_b: string): number {
	return new Version(s_version_a).compare(new Version(s_version_b));
}

export function precedes(s_version_a: string, s_version_b: string): boolean {
	return new Version(s_version_a).precedes(new Version(s_version_b));
}

export function follows(s_version_a: string, s_version_b: string): boolean {
	return new Version(s_version_a).follows(new Version(s_version_b));
}

export class Version {
	private readonly _a_parts: Part[];

	constructor(s_version: string) {
		this._a_parts = s_version.replace(/^v/, '').split(/\./).map((s_part) => {
			const a_subs = s_part.split('-');
			return {
				value: +a_subs[0],
				tag: a_subs.slice(1).join('-'),
			};
		});
	}

	compare(k_other: Version): number {
		const a_parts_this = this._a_parts;
		const a_parts_other = k_other._a_parts;

		for(let i_part=0; i_part<Math.min(a_parts_this.length, a_parts_other.length); i_part++) {
			const {
				value: x_value_this,
				tag: s_tag_this,
			} = a_parts_this[i_part];

			const {
				value: x_value_other,
				tag: s_tag_other,
			} = a_parts_other[i_part];

			if(s_tag_this !== s_tag_other) return NaN;

			const x_cmp = x_value_this - x_value_other;
			if(0 !== x_cmp) return x_cmp;
		}

		return 0;
	}

	precedes(k_other: Version): boolean {
		return -1 === this.compare(k_other);
	}

	follows(k_other: Version): boolean {
		return 1 === this.compare(k_other);
	}
}
