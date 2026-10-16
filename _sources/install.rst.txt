安装与运行环境配置
==================

这里安装的是 Python 计算程序及依赖，不是网页或浏览器插件。
阅读下载包内的 ``docs/manuals/public/user_manual.html`` 无需安装。
GitHub 下载的是源码，**没有预先生成的 docs/_build/html 目录**；
需要依次完成下面的环境安装、网页构建和文件检查，才能打开配置生成器。

准备与定位项目文件夹
--------------------

先完整解压下载的 ZIP；包含 ``pyproject.toml``、``README.md``、``src/`` 和
``docs/`` 的文件夹就是项目根目录。

* macOS：打开“应用程序 → 实用工具 → 终端”，输入 ``cd`` 和一个空格，
  把解压后的项目文件夹拖入终端，再按回车；执行 ``ls pyproject.toml`` 确认位置。
* Windows：在文件资源管理器中进入该文件夹，在地址栏输入 ``powershell`` 并按回车；
  执行 ``Test-Path .\pyproject.toml``，应输出 ``True``。
* Linux：在项目文件夹打开终端，执行 ``ls pyproject.toml`` 确认位置。

需要 `Python <https://www.python.org/downloads/>`_ 3.10 或以上
（本次 macOS 走查使用 3.13.9；新手可选常规 3.13.x 安装程序），以及
`Node.js <https://nodejs.org/en/download>`_ 24.x、版本不低于 24.15.0。
下载适合自己系统的安装程序，不是源码压缩包。安装后重新打开终端；
Windows 安装方式参见 `Python 官方说明 <https://docs.python.org/3/using/windows.html>`_。
Node 用于生成网页时检查脚本；生成后的网页用浏览器离线打开即可。
没有 GPU 也能用 CPU 进行首次短运行。

推荐方式：从源码开始
--------------------

在项目根目录打开终端（macOS/Linux）：

.. code-block:: bash

   python3 --version
   node --version
   python3 -m venv .venv
   source .venv/bin/activate
   python -m pip install --upgrade pip
   python -m pip install -e ".[test,docs]"
   python -c "import openpinn; print(openpinn.__version__)"

Windows PowerShell 使用：

.. code-block:: powershell

   python --version
   node --version
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install --upgrade pip
   .\.venv\Scripts\python.exe -m pip install -e ".[test,docs]"
   .\.venv\Scripts\python.exe -c "import openpinn; print(openpinn.__version__)"

最后应输出 ``0.2.0``。Windows 后续运行也使用 ``.\.venv\Scripts\python.exe``，
不需要激活环境或修改执行策略。macOS/Linux 新开终端后，先回到项目根目录并执行
``source .venv/bin/activate``。命令逐行执行，有错误先停止，不要继续后续步骤。

``-e`` 表示可编辑安装。修改 ``src/openpinn/`` 后可以直接重新运行，不需要每次重装。

已有 Conda 或 CUDA 环境
-----------------------

先进入原有环境，再执行：

.. code-block:: powershell

   python -m pip install -e ".[test,docs]"

不要为了运行本项目盲目覆盖原有 PyTorch/CUDA 组合。如果安装时准备下载另一套大型 PyTorch，请先停止并检查当前环境。

生成网页并确认文件存在
----------------------

macOS/Linux（已激活环境）：

.. code-block:: bash

   python scripts/build_docs.py
   ls docs/_build/html/method_configurator.html

Windows PowerShell：

.. code-block:: powershell

   .\.venv\Scripts\python.exe scripts/build_docs.py
   Test-Path .\docs\_build\html\method_configurator.html

先确认构建无报错，并以 ``Documentation built:`` 输出结束；
再检查文件，macOS/Linux 应列出文件名，Windows 应显示 ``True``。
失败时不要手动创建空文件夹，也不要把旧页面存在误认为更新成功。

然后在文件管理器中打开 ``docs → _build → html → method_configurator.html``。
侧栏的 :doc:`user_guide` 介绍具体操作，:doc:`developer_guide` 用于开发维护。
网页只负责配置和生成代码，训练仍需在上述 Python 环境中运行。

当前源码仓库不提供 ``dist/`` 下的 wheel 安装包，请使用本页的源码安装方法。
只运行 Sphinx 不会更新两份说明书，首次构建和源码更新后均使用统一的
``scripts/build_docs.py``。

第一次运行请按 :doc:`user_guide_start` 中的“先从网页下载一个 Poisson 示例”操作，
先跑通 5 步，再考虑自己的几何和方程。
