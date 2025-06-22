PS C:\Users\Goncalo\pombot> // components/header-wrapper.tsx
// : The term '//' is not recognized as the name of a cmdlet, function, script file, or operable 
program. Check the spelling of the name, or if a path was included, verify that the path is 
correct and try again.
At line:1 char:1
+ // components/header-wrapper.tsx
+ ~~
    + CategoryInfo          : ObjectNotFound: (//:String) [], CommandNotFoundException      
 
PS C:\Users\Goncalo\pombot> import { cookies } from 'next/headers'
import : The term 'import' is not recognized as the name of a cmdlet, function, script file, or    
operable program. Check the spelling of the name, or if a path was included, verify that the path  
is correct and try again.
At line:1 char:1
+ import { cookies } from 'next/headers'
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (import:String) [], CommandNotFoundException
 
PS C:\Users\Goncalo\pombot> import { auth } from '@/auth'
import : The term 'import' is not recognized as the name of a cmdlet, function, script file, or    
operable program. Check the spelling of the name, or if a path was included, verify that the path  
is correct and try again.
At line:1 char:1
+ import { auth } from '@/auth'
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (import:String) [], CommandNotFoundException
 
PS C:\Users\Goncalo\pombot> import { HeaderClient } from './header-client'
import : The term 'import' is not recognized as the name of a cmdlet, function, script file, or    
operable program. Check the spelling of the name, or if a path was included, verify that the path  
is correct and try again.
At line:1 char:1
+ import { HeaderClient } from './header-client'
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (import:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
 
PS C:\Users\Goncalo\pombot>
PS C:\Users\Goncalo\pombot> export async function HeaderWrapper() {
>>   const cookieStore = cookies()
>>   const session = await auth({ cookieStore })
>> 
>>   return <HeaderClient session={session} />
>> }