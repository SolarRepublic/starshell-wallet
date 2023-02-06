# "Snake Typing" Variable Prefix Semantics

This repository makes use of a coding convention that is similar to Hungarian notation, which prefixes identifiers with a short 1-3 character semantic tag to identify its _use_, which is generally a subset of its primitive _type_. 

For example, there are many different uses for `number`. Some numbers index items in an array, some are used to count the occurence of an event, while others are used for arithmetic. In Snake Typing, each of these uses has a different prefix, communicating an identifier's purpose right away and enhancing its "grok".

In this project, the prefixes used are checked and enforced by special logic in the `.eslintrc.cjs` file.

The following list details the semantics of these prefixes:

 - `a_` - an Array; `Array.isArray(a_thing) === true`
    - `as_` a Set; `as_thing instanceof Set === true`
    - `ab_` an ArrayBuffer; `ab_thing instanceof ArrayBuffer === true`
    - `at_` a TypedArray; `ArrayBuffer.isView(at_thing) === true`
      - `atu8_` a Unit8Array; `atu8_thing instanceof Uint8Array === true`
 - `b_` - a boolean; `typeof b_thing === 'boolean'`
 - `c_` - a counter variable, will only ever increment; `typeof c_thing === 'number'`
 - `d_` - native or builtin runtime object
    - `dc_` - reference to a Class constructor
    - `dm_` - reference to a DOM element
    - `dp_` - reference to a Promise
    - `d{..}_` -- _other natives or builtins_
 - `e_` - an instance of Error; `e_thing instanceof Error === true`
 - `f_` - a function; `typeof f_thing === 'function'`
    - `fk_` - a "success" callback, such as the Promise resolve callback
    - `fe_` - an "error" callback, such as the Promise rejection callback
    - `fg_` - a generator function
 - `g_` - a struct with known keys (members accessed via dot-notation)
    - `gc_` - a config struct for constructors
 - `h_` - a dictionary with arbitrary keys (members accessed via brackets)
    - `hm_` - a map; `hm_thing instance Map === true`
 - `i_` - an index variable used for accessing an item at a certain position within an array/string/buffer; `typeof i_thing === 'number'`
   - `ib_` - byte offset within a TypedArray
 - `j_` - _not used; too similar looking to `i_`_
 - `k_` - a 'friend' instance (i.e., one whose class is controlled by you). signifies that it is OK to access its private/undocumented members
    - `k{..}_` arbitrary prefix modifiers to further distinguish between frequently used objects
 - `l_` - _not used; too similar looking to `I_`_
 - `m_` - a RegExp match object
 - `n_` - an integer quantity; `typeof n_thing === 'number'`
   - `nl_` - the cached `.length` value of a string or array
 - `o_` - _not used; `O_` can look too similar to `0_`_
 - `p_` - a string that is a file system path or IRI used to locate a resource; `typeof p_thing === 'string'`
   - `pr_` - relative path string
   - `pd_` - container/parent path element, such as a directory
 - `q_` - _not used; too similar looking to `p_`_
 - `r_` - a RegExp object; `r_thing instanceof RegExp === true`
    - `rt_` - a RegExp object that is only intended for use with the `.test()` method. these instances should **never have the global modifier**
 - `s_` - a generic string; `typeof s_thing === 'string'`
    - `si_` - a string that uniquely identifies an entity, such as a key in a hash map
    - `sq_` - a query string that will be submitted elsewhere
    - `sr_` - a relative file name or individual path part
    - `sx_` - a string of code or language-specific string that will be parsed during runtime
 - `t_` - _not used_
 - `u_` - _not used_
 - `v_` - _not used_
 - `w_` - any value, i.e. 'whatever'; the variable's type does not matter within this scope; it is merely forwarded to another function call
 - `x_` - a decimal number which will be used for arithmetic
   - `xc_` - an enum value or fixed code value
   - `xm_` - a bitmask value
   - `xg_` - bigint; `typeof xg_thing === 'bigint'`
 - `y_` - an instance of a class belonging to another library. signifies that it is only OK to access its public members
    - `y{..}_` arbitrary prefix modifiers to further distinguish between frequently used objects
 - `z_` - an unknown or ambiguous type that must be duck-typed before it is used
 